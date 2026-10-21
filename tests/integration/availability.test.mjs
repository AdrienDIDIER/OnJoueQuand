import { test } from "node:test";
import assert from "node:assert/strict";
import { clients, checked, identity } from "../../scripts/local-supabase.mjs";
import { Temporal } from "@js-temporal/polyfill";

test("J3 : transactions, contraintes et RLS des disponibilités", async (t) => {
  const { admin, anonymous } = clients();
  const owner = await identity(admin, anonymous, "dispos");
  const other = await identity(admin, anonymous, "autre-dispos");
  const outsider = await identity(admin, anonymous, "hors-groupe-dispos");
  let group = checked(await admin.from("groups").select("id").maybeSingle());
  if (!group) group = checked(await admin.from("groups").insert({}).select("id").single());
  const profiles = [owner, other].map((p) => ({ user_id: p.user.id, display_name: "Recette disponibilités" }));
  checked(await admin.from("profiles").insert(profiles));
  const members = checked(await admin.from("memberships").insert([owner, other].map((p) => ({ group_id: group.id, user_id: p.user.id }))).select("*"));
  const member = members.find((m) => m.user_id === owner.user.id);
  const monday = Temporal.Now.zonedDateTimeISO("Europe/Paris").toPlainDate().subtract({ days: Temporal.Now.zonedDateTimeISO("Europe/Paris").dayOfWeek - 1 });
  const day = (n) => monday.add({ days: n }).toString();
  const instant = (d, time) => Temporal.PlainDateTime.from(`${d}T${time}`).toZonedDateTime("Europe/Paris").toInstant().toString();
  const change = (n, status = "unavailable", revision = null, intervals = []) => ({ local_date: day(n), status, mode: status === "available" ? "detailed" : null, expected_revision: revision, intervals });
  const range = (n, a = "20:00", b = "23:00") => ({ starts_at: instant(day(n), a), ends_at: instant(day(n), b) });
  try {
    await t.test("réponses explicites, lecture collective et propriétaire issu du JWT", async () => {
      checked(await owner.client.rpc("save_availability", { changes: [change(0, "available", null, [range(0)])] }));
      const rows = checked(await other.client.from("availability_days").select("*").eq("membership_id", member.id));
      assert.equal(rows.length, 1); assert.equal(rows[0].status, "available");
      assert.ok((await owner.client.from("availability_days").update({ status: "unavailable" }).eq("id", rows[0].id)).error);
      assert.ok((await other.client.from("availability_intervals").delete().eq("day_id", rows[0].id)).error);
      for (const client of [anonymous(), outsider.client]) {
        const read = await client.from("availability_days").select("*");
        assert.ok(read.error || read.data.length === 0);
        assert.ok((await client.rpc("save_availability", { changes: [change(1)] })).error);
      }
      checked(await other.client.rpc("save_availability", { changes: [change(0)] }));
      assert.equal(checked(await owner.client.from("availability_days").select("status").eq("membership_id", member.id).eq("local_date", day(0)).single()).status, "available");
    });
    await t.test("deux créations concurrentes : une seule réussit", async () => {
      const results = await Promise.all([1, 2].map(() => owner.client.rpc("save_availability", { changes: [change(1)] })));
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.equal(checked(await owner.client.from("availability_days").select("*").eq("membership_id", member.id).eq("local_date", day(1))).length, 1);
    });
    await t.test("échec de la deuxième journée : première journée annulée aussi", async () => {
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(2), change(3, "available", null, [])] })).error);
      assert.equal(checked(await owner.client.from("availability_days").select("*").eq("membership_id", member.id).in("local_date", [day(2), day(3)])).length, 0);
    });
    await t.test("contraintes : chevauchement, bornes, état et pas de quinze minutes", async () => {
      for (const intervals of [[range(2), range(2, "21:00", "23:00")], [range(1)], [range(2, "20:07", "23:00")]]) {
        assert.ok((await owner.client.rpc("save_availability", { changes: [change(2, "available", null, intervals)] })).error);
      }
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(2, "unavailable", null, [range(2)])] })).error);
      checked(await owner.client.rpc("save_availability", { changes: [change(2, "available", null, [range(2, "20:00", "21:00"), range(2, "21:00", "22:00")])] }));
    });
    await t.test("horizon évalué en base : passé et cinquième semaine refusés", async () => {
      for (const n of [-1, 28]) assert.ok((await owner.client.rpc("save_availability", { changes: [change(n)] })).error);
    });
    await t.test("source et cible modifiées depuis l’aperçu : copie refusée entièrement", async () => {
      const guard = { local_date: day(0), expected_revision: 1 };
      checked(await owner.client.rpc("save_availability", { changes: [change(0, "unavailable", 1)] }));
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(7)], sources: [guard] })).error);
      checked(await owner.client.rpc("save_availability", { changes: [change(7)] }));
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(7), change(8)], sources: [{ ...guard, expected_revision: 2 }] })).error);
      assert.equal(checked(await owner.client.from("availability_days").select("*").eq("membership_id", member.id).eq("local_date", day(8))).length, 0);
    });
    await t.test("minuit atomique, révision obsolète et remise sans réponse", async () => {
      const boundary = instant(day(5), "00:00");
      checked(await owner.client.rpc("save_availability", { changes: [change(4, "available", null, [{ starts_at: instant(day(4), "23:00"), ends_at: boundary }]), change(5, "available", null, [range(5, "00:00", "01:00")])] }));
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(4, "unavailable", null)] })).error);
      checked(await owner.client.rpc("save_availability", { changes: [change(4, "unanswered", 1)] }));
      const row = checked(await owner.client.from("availability_days").select("*, availability_intervals(*)").eq("membership_id", member.id).eq("local_date", day(4)).single());
      assert.equal(row.status, "unanswered"); assert.equal(row.availability_intervals.length, 0);
    });
    await t.test("calendrier de quinze membres lisible sans perte de réponses", async () => {
      const users = []; const added = [];
      try {
        for (let i = 0; i < 13; i++) {
          const person = await identity(admin, anonymous, `calendrier-${i}`, false); users.push(person.user.id);
          checked(await admin.from("profiles").insert({ user_id: person.user.id, display_name: `Membre calendrier ${i + 1}` }));
          added.push(checked(await admin.from("memberships").insert({ group_id: group.id, user_id: person.user.id }).select("id").single()).id);
        }
        const ids = [...members.map((m) => m.id), ...added];
        checked(await admin.from("availability_days").insert(ids.map((id) => ({ group_id: group.id, membership_id: id, local_date: day(10), status: "unavailable", mode: null }))));
        const calendar = checked(await owner.client.from("availability_days").select("*, availability_intervals(starts_at,ends_at)").in("membership_id", ids).eq("local_date", day(10)));
        assert.equal(calendar.length, 15); assert.ok(calendar.every((d) => d.status === "unavailable" && d.availability_intervals.length === 0));
      } finally {
        if (added.length) {
          checked(await admin.from("availability_days").delete().in("membership_id", added));
          checked(await admin.from("memberships").delete().in("id", added));
        }
        if (users.length) checked(await admin.from("profiles").delete().in("user_id", users));
        for (const id of users) checked(await admin.auth.admin.deleteUser(id));
      }
    });
    await t.test("membre révoqué : plus de lecture ni de mutation avec son jeton existant", async () => {
      checked(await admin.from("memberships").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", member.id));
      assert.deepEqual(checked(await owner.client.from("availability_days").select("*")), []);
      assert.ok((await owner.client.rpc("save_availability", { changes: [change(6)] })).error);
    });
  } finally {
    // Uniquement les identités synthétiques créées par cette suite ; aucune donnée existante supprimée.
    checked(await admin.from("availability_days").delete().in("membership_id", members.map((m) => m.id)));
    checked(await admin.from("memberships").delete().in("id", members.map((m) => m.id)));
    checked(await admin.from("profiles").delete().in("user_id", [owner.user.id, other.user.id]));
    for (const p of [owner, other, outsider]) checked(await admin.auth.admin.deleteUser(p.user.id));
  }
});
