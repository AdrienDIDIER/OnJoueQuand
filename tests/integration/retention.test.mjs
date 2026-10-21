import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { clients, checked, identity } from "../../scripts/local-supabase.mjs";

test("J8 : conservation, frontière Paris, cascades, baux et concurrence sur base synthétique", async () => {
  let config, container = "supabase_db_OnJoueQuand";
  if (process.env.OPS_TEST_WORKDIR) {
    const workdir = process.env.OPS_TEST_WORKDIR;
    const project = readFileSync(`${workdir}/supabase/config.toml`, "utf8").match(/project_id\s*=\s*"([^"]+)"/)?.[1];
    if (!/^OnJoueQuandJ\d+Validation$/.test(project ?? "")) throw new Error("Stack synthétique JxValidation obligatoire.");
    container = `supabase_db_${project}`;
    const data = JSON.parse(execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "--workdir", workdir, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    if (new URL(data.API_URL).hostname !== "127.0.0.1") throw new Error("Base locale obligatoire.");
    config = { url: data.API_URL, key: data.ANON_KEY, secret: data.SERVICE_ROLE_KEY };
  } else if (process.env.CI !== "true") throw new Error("Une stack synthétique explicite est obligatoire hors CI.");
  const { admin, anonymous } = clients(config);
  const existing = checked(await admin.from("groups").select("id").maybeSingle());
  const group = existing ?? checked(await admin.from("groups").insert({ name: "Recette conservation" }).select("id").single());
  const actor = await identity(admin, anonymous, "retention-admin");
  let member;
  try {
    checked(await admin.from("profiles").insert({ user_id: actor.user.id, display_name: "Recette conservation" }));
    member = checked(await admin.from("memberships").insert({ user_id: actor.user.id, group_id: group.id, role: "admin" }).select("id").single());
    // Même un administrateur connecté ne peut déclencher la purge ou choisir son horloge.
    for (const client of [anonymous(), actor.client]) assert.ok((await client.rpc("purge_retained_data")).error);
    const args = ["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];
    try {
      execFileSync("docker", [...args, "-v", `actor=${actor.user.id}`, "-v", `group=${group.id}`], { input: readFileSync(new URL("./retention.sql", import.meta.url)), stdio: ["pipe", "pipe", "pipe"] });
      // Deux connexions réellement distinctes ; rollback intégral de chaque purge.
      const statement = "begin; select public.purge_retained_data(1,'2026-10-25T23:30:00Z'); select pg_sleep(0.1); rollback;";
      const results = await Promise.all([0, 1].map(() => promisify(execFile)("docker", [...args, "-A", "-t", "-c", statement], { encoding: "utf8" })));
      for (const result of results) {
        const metrics = JSON.parse(result.stdout.split(/\r?\n/).find((line) => line.startsWith("{")));
        assert.ok(Object.values(metrics).every((count) => Number.isInteger(count) && count >= 0 && count <= 1));
      }
    } catch (error) {
      const diagnostic = String(error.stderr ?? "").match(/ERROR:\s*([^\r\n]+)/)?.[1]?.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g,"[adresse masquée]").replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g,"[identifiant]");
      throw new Error(diagnostic ? `Invariant non respecté : ${diagnostic}` : "Échec de la recette SQL de conservation (diagnostics SQL non affichés).", { cause: undefined });
    }
  } finally {
    if (member) checked(await admin.from("memberships").delete().eq("id", member.id));
    checked(await admin.from("profiles").delete().eq("user_id", actor.user.id));
    checked(await admin.auth.admin.deleteUser(actor.user.id));
  }
});
