import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createBackup, dumpArguments } from "./backup.mjs";

// Refus absolu du conteneur utilisateur principal : uniquement une stack de recette dédiée.
const container = process.env.REHEARSAL_CONTAINER;
if (!/^supabase_db_OnJoueQuandJ[0-9]+Validation$/.test(container ?? "")) throw new Error("Un conteneur synthétique JxValidation est obligatoire.");
const database = `ojq_restore_${randomUUID().replaceAll("-", "")}`;
const age = process.env.AGE_BIN || "age";
const keygen = process.env.AGE_KEYGEN_BIN || "age-keygen";
const directory = await mkdtemp(join(tmpdir(), "ojq-restore-"));
const run = (args, input) => execFileSync("docker", ["exec", "-i", container, ...args], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const sql = (db, text) => run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db, "-At"], text).trim();
let created = false;
let stage = "contrôle de la source";
try {
  // Garde supplémentaire : aucune identité non synthétique dans la source.
  if (sql("postgres", "select count(*) from auth.users where email is null or email not like '%@example.test';") !== "0") throw new Error("La source contient des identités non synthétiques.");
  const key = join(directory, "identity");
  execFileSync(keygen, ["-o", key], { stdio: "ignore" });
  const recipient = execFileSync(keygen, ["-y", key], { encoding: "utf8" }).trim();
  const archive = join(directory, "snapshot.age");
  stage = "export chiffré";
  await createBackup({ output: archive, recipient, age, command: ["docker", "exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", ...dumpArguments] });
  stage = "création de la cible";
  sql("postgres", `create database ${database} template template0;`); created = true;
  sql(database, "drop schema public; create schema extensions; create extension btree_gist with schema extensions;");
  const decrypt = spawn(age, ["-d", "-i", key, "-o", "-", archive], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  stage = "chargement du schéma et des données";
  const restore = spawn("docker", ["exec", "-i", container, "pg_restore", "--exit-on-error", "--single-transaction", "--no-owner", "-U", "supabase_admin", "-d", database], { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
  // Diagnostics SQL conservés en mémoire, jamais affichés (ils peuvent contenir des données).
  let diagnostics = "";
  restore.stderr.on("data", (chunk) => { diagnostics += chunk; });
  const done = (child) => new Promise((accept, reject) => { child.once("error", reject); child.once("close", (code) => code === 0 ? accept() : reject(new Error("Restauration interrompue."))); });
  try { await Promise.all([done(decrypt), done(restore), pipeline(decrypt.stdout, restore.stdin)]); }
  catch (error) {
    // N’exposer que la catégorie technique reconnue, jamais le message SQL brut.
    if (diagnostics.includes('schema "extensions" does not exist')) console.error("Schéma extensions manquant.");
    if (diagnostics.includes("permission denied")) console.error("Droits de restauration insuffisants.");
    if (diagnostics.includes("already exists")) console.error("Objet déjà présent dans la cible.");
    if (diagnostics.includes("does not exist")) console.error("Dépendance absente de la cible.");
    throw error;
  }
  stage = "vérification des données et des droits";
  const fingerprint = `select json_build_object('users',(select count(*) from auth.users),'members',(select count(*) from public.memberships),'days',(select count(*) from public.availability_days),'sessions',(select count(*) from public.sessions),'policies',(select count(*) from pg_policies where schemaname='public'),'constraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private','auth')),'migrations',(select count(*) from supabase_migrations.schema_migrations));`;
  const before = JSON.parse(sql("postgres", fingerprint));
  const after = JSON.parse(sql(database, fingerprint));
  const differences = Object.keys(before).filter((name) => before[name] !== after[name]);
  if (differences.length) { console.error(`Compteurs différents : ${differences.join(", ")}.`); throw new Error("Écart après restauration."); }
  stage = "vérification du refus anonyme";
  try {
    const blocked = sql(database, "begin; set local role anon; select count(*) from public.memberships; rollback;");
    if (!blocked.split(/\r?\n/).includes("0")) throw new Error("La lecture anonyme n’est pas bloquée.");
  } catch (error) {
    if (!String(error.stderr).includes("permission denied for table memberships")) throw error;
  }
  const unaffiliated = sql(database, "begin; set local role authenticated; select count(*) from public.memberships; rollback;");
  if (!unaffiliated.split(/\r?\n/).includes("0")) throw new Error("Un compte sans adhésion accède aux données.");
  if (!before.members) throw new Error("La recette exige au moins une adhésion synthétique.");
  const member = sql(database, "begin; select set_config('request.jwt.claim.sub',(select user_id::text from public.memberships where status='active' limit 1),true); set local role authenticated; select count(*) from public.memberships; rollback;");
  if (!member.split(/\r?\n/).includes(String(before.members))) throw new Error("Le membre actif ne retrouve pas les données.");
  console.log("Restauration synthétique réussie : Auth, relations, migrations, contraintes et politiques conservées ; anonyme et non-membre bloqués, membre autorisé.");
  console.log("Les rôles système sont partagés dans ce cluster. Une restauration Supabase hébergée et un parcours OTP restent à valider séparément.");
} catch {
  console.error(`Répétition en échec : ${stage}. Aucun diagnostic contenant des données n’a été affiché.`);
  process.exitCode = 1;
} finally {
  if (created) sql("postgres", `drop database ${database} with (force);`);
  await rm(directory, { recursive: true, force: true });
}
