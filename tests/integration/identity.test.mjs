import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { clients, checked, identity, mailboxCode } from "../../scripts/local-supabase.mjs";
import { sendEmailCode } from "../../src/features/auth/infrastructure/email-code.ts";

test("J2 : Auth réel, invitations, RLS et concurrence", async (t) => {
  const { admin, anonymous, config } = clients();
  const owner = await identity(admin, anonymous, "admin");
  checked(await admin.rpc("bootstrap_admin", { account_id: owner.user.id, display_name: "Administrateur test" }));
  const outsider = await identity(admin, anonymous, "externe");
  let invited;
  let invitationId;
  await t.test("inscription publique refusée et aucune lecture anonyme ou non membre", async () => {
    assert.ok((await anonymous().auth.signUp({ email: "interdit@example.test", password: randomUUID() })).error);
    for (const table of ["groups", "profiles", "memberships", "invitations"]) {
      const anon = await anonymous().from(table).select("*");
      assert.ok(anon.error || anon.data.length === 0);
      assert.deepEqual(checked(await outsider.client.from(table).select("*")), []);
    }
    assert.ok((await outsider.client.rpc("create_invitation", { email: "interdit@example.test", request_id: randomUUID() })).error);
    assert.ok((await outsider.client.rpc("bootstrap_admin", { account_id: outsider.user.id, display_name: "Intrus" })).error);
    assert.ok((await outsider.client.rpc("consume_auth_limit", { key_hash: "x", max_attempts: 999 })).error);
    checked(await outsider.client.auth.updateUser({ data: { role: "admin" } }));
    assert.ok((await outsider.client.rpc("create_invitation", { email: "interdit@example.test", request_id: randomUUID() })).error);
  });
  await t.test("invitation idempotente, compte non confirmé et OTP réel", async () => {
    invited = await identity(admin, anonymous, "invite", false);
    assert.equal(invited.user.email_confirmed_at, undefined);
    const args = { email: invited.email.toUpperCase(), request_id: randomUUID() };
    invitationId = checked(await owner.client.rpc("create_invitation", args));
    assert.equal(checked(await owner.client.rpc("create_invitation", args)), invitationId);
    const context = checked(await admin.rpc("provisioning_context", { invitation_id: invitationId, actor_id: owner.user.id }));
    assert.equal(context.user_id, invited.user.id);
    checked(await admin.rpc("record_invitation_delivery", { invitation_id: invitationId, actor_id: owner.user.id, delivered: false }));
    checked(await sendEmailCode(invited.client, invited.email));
    const code = await mailboxCode(config.mailUrl, invited.email);
    assert.ok((await invited.client.auth.verifyOtp({ email: invited.email, token: "000000", type: "email" })).error);
    checked(await invited.client.auth.verifyOtp({ email: invited.email, token: code, type: "email" }));
    assert.ok((await anonymous().auth.verifyOtp({ email: invited.email, token: code, type: "email" })).error);
    checked(await admin.rpc("record_invitation_delivery", { invitation_id: invitationId, actor_id: owner.user.id, delivered: true }));
  });
  await t.test("mauvaise identité refusée, acceptation concurrente idempotente", async () => {
    assert.ok((await outsider.client.rpc("accept_invitation", { display_name: "Intrus" })).error);
    const results = await Promise.all([1, 2].map(() => invited.client.rpc("accept_invitation", { display_name: "Joueur" })));
    assert.equal(checked(results[0]), checked(results[1]));
    assert.equal(checked(await invited.client.from("memberships").select("*")).length, 2);
    assert.deepEqual(checked(await invited.client.from("invitations").select("*")), []);
    assert.ok((await invited.client.from("memberships").update({ role: "admin" }).eq("user_id", invited.user.id)).error);
    assert.ok((await invited.client.from("profiles").update({ display_name: "Vol" }).eq("user_id", owner.user.id)).error);
    checked(await invited.client.rpc("update_profile", { display_name: "Nouveau nom", expected_revision: 1 }));
    assert.ok((await invited.client.rpc("update_profile", { display_name: "Écrasement", expected_revision: 1 })).error);
  });
  await t.test("invitations expirées et révoquées ne donnent aucun accès", async () => {
    for (const kind of ["expired", "revoked"]) {
      const person = await identity(admin, anonymous, kind);
      const id = checked(await owner.client.rpc("create_invitation", { email: person.email, request_id: randomUUID() }));
      if (kind === "revoked") checked(await owner.client.rpc("revoke_invitation", { invitation_id: id, expected_revision: 1 }));
      else checked(await admin.from("invitations").update({ expires_at: "2000-01-01T00:00:00Z" }).eq("id", id));
      assert.ok((await person.client.rpc("accept_invitation", { display_name: "Refusé" })).error);
    }
  });
  await t.test("un code expiré est refusé par Auth", async () => {
    const person = await identity(admin, anonymous, "code-expire", false);
    checked(await sendEmailCode(person.client, person.email));
    const code = await mailboxCode(config.mailUrl, person.email);
    assert.match(person.user.id, /^[0-9a-f-]{36}$/);
    execFileSync("docker", ["exec", "-i", "supabase_db_OnJoueQuand", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: `update auth.users set confirmation_sent_at = now() - interval '11 minutes' where id = '${person.user.id}';`, stdio: ["pipe", "pipe", "pipe"],
    });
    assert.ok((await person.client.auth.verifyOtp({ email: person.email, token: code, type: "email" })).error);
  });
  await t.test("deux retraits concurrents préservent un administrateur", async () => {
    const members = checked(await owner.client.from("memberships").select("*"));
    const player = members.find((m) => m.user_id === invited.user.id);
    checked(await owner.client.rpc("change_membership", { membership_id: player.id, expected_revision: player.revision, new_role: "admin", new_status: "active" }));
    const current = checked(await owner.client.from("memberships").select("*"));
    const results = await Promise.all(current.map((m) => (m.user_id === owner.user.id ? owner.client : invited.client).rpc("change_membership", { membership_id: m.id, expected_revision: m.revision, new_role: "member", new_status: "active" })));
    assert.equal(results.filter((r) => !r.error).length, 1);
    const active = checked(await admin.from("memberships").select("*").eq("role", "admin").eq("status", "active"));
    assert.equal(active.length, 1);
    const remaining = active[0].user_id === owner.user.id ? owner : invited;
    const victim = remaining === owner ? invited : owner;
    const target = checked(await remaining.client.from("memberships").select("*").eq("user_id", victim.user.id).single());
    checked(await remaining.client.rpc("change_membership", { membership_id: target.id, expected_revision: target.revision, new_role: "member", new_status: "revoked" }));
    assert.ok((await victim.client.auth.getUser()).data.user);
    for (const table of ["groups", "profiles", "memberships", "invitations"]) assert.deepEqual(checked(await victim.client.from(table).select("*")), []);
    assert.ok((await victim.client.rpc("accept_invitation", { display_name: "Retour" })).error);
  });
  await t.test("limitation atomique et fonctions privilégiées inaccessibles", async () => {
    const key_hash = randomUUID();
    const results = await Promise.all(Array.from({ length: 8 }, () => admin.rpc("consume_auth_limit", { key_hash, max_attempts: 3 })));
    assert.equal(results.map(checked).filter(Boolean).length, 3);
    assert.ok((await outsider.client.rpc("provisioning_context", { invitation_id: invitationId, actor_id: owner.user.id })).error);
  });
  await t.test("panne SMTP : invitation conservée et nouvel envoi possible", async () => {
    const active = checked(await admin.from("memberships").select("user_id").eq("role", "admin").eq("status", "active").single());
    const actor = active.user_id === owner.user.id ? owner : invited;
    const person = await identity(admin, anonymous, "smtp", false);
    const id = checked(await actor.client.rpc("create_invitation", { email: person.email, request_id: randomUUID() }));
    try {
      execFileSync("docker", ["stop", "--time", "1", "supabase_inbucket_OnJoueQuand"], { stdio: "pipe" });
      assert.ok((await sendEmailCode(person.client, person.email)).error);
      checked(await admin.rpc("record_invitation_delivery", { invitation_id: id, actor_id: actor.user.id, delivered: false }));
    } finally {
      execFileSync("docker", ["start", "supabase_inbucket_OnJoueQuand"], { stdio: "pipe" });
    }
    const pending = checked(await actor.client.from("invitations").select("status,delivery_status").eq("id", id).single());
    assert.deepEqual(pending, { status: "pending", delivery_status: "failed" });
    let response;
    for (let attempt = 0; attempt < 10; attempt++) {
      response = await sendEmailCode(person.client, person.email);
      if (!response.error) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    checked(response);
    assert.ok(await mailboxCode(config.mailUrl, person.email));
    const context = checked(await admin.rpc("provisioning_context", { invitation_id: id, actor_id: actor.user.id }));
    assert.equal(context.user_id, person.user.id);
  });
});
