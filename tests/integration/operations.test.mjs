import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { clients, checked, identity } from "../../scripts/local-supabase.mjs";

test("J8 : diagnostic agrégé réservé aux administrateurs actifs avec le JWT réel", async () => {
  let config;
  if (process.env.OPS_TEST_WORKDIR) {
    const data = JSON.parse(execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "--workdir", process.env.OPS_TEST_WORKDIR, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    if (new URL(data.API_URL).hostname !== "127.0.0.1") throw new Error("Base de recette locale obligatoire.");
    config = { url: data.API_URL, key: data.ANON_KEY, secret: data.SERVICE_ROLE_KEY };
  } else if (process.env.CI !== "true") throw new Error("Utiliser OPS_TEST_WORKDIR pour la base synthétique dédiée.");
  const { admin, anonymous } = clients(config);
  const group = checked(await admin.from("groups").select("id").single());
  const actors = [];
  const members = [];
  try {
    for (const name of ["administrateur", "membre", "externe", "revoque"]) actors.push(await identity(admin, anonymous, `operations-${name}`));
    for (const [index, actor] of actors.entries()) {
      if (index === 2) continue;
      checked(await admin.from("profiles").insert({ user_id: actor.user.id, display_name: "Recette exploitation" }));
      members.push(checked(await admin.from("memberships").insert({ user_id: actor.user.id, group_id: group.id, role: index === 1 ? "member" : "admin" }).select("*").single()));
    }
    const revoked = members.find((member) => member.user_id === actors[3].user.id);
    checked(await admin.from("memberships").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", revoked.id));
    for (const client of [anonymous(), actors[1].client, actors[2].client, actors[3].client]) assert.ok((await client.rpc("notification_job_status")).error);
    const status = checked(await actors[0].client.rpc("notification_job_status"));
    assert.equal(typeof status.cron_active, "boolean");
    assert.ok(Number.isFinite(Date.parse(status.checked_at)));
    assert.ok(status.worker_age_seconds === null || typeof status.worker_age_seconds === "number");
    assert.equal(typeof status.outbox_age_seconds, "number");
    assert.deepEqual(Object.keys(status).sort(), ["checked_at", "cron_active", "last_run", "last_success_at", "worker_age_seconds", "outbox_age_seconds", "outbox_pending", "outbox_failed", "deliveries_pending", "deliveries_failed"].sort());
    // Le rôle vient de la base à chaque appel, pas d’un ancien jeton d’administration.
    checked(await admin.from("memberships").update({ role: "member" }).eq("user_id", actors[0].user.id));
    assert.ok((await actors[0].client.rpc("notification_job_status")).error);
  } finally {
    if (members.length) checked(await admin.from("memberships").delete().in("id", members.map((member) => member.id)));
    if (actors.length) {
      checked(await admin.from("profiles").delete().in("user_id", actors.map((actor) => actor.user.id)));
      for (const actor of actors) checked(await admin.auth.admin.deleteUser(actor.user.id));
    }
  }
});
