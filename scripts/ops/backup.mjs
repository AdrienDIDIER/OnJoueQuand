import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { link, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

export const dumpArguments = ["--format=custom", "--no-owner", "--strict-names", ...["public", "private", "auth", "supabase_migrations"].map((schema) => `--schema=${schema}`)];

function completion(child) {
  return new Promise((accept, reject) => {
    child.once("error", () => reject(new Error("Outil de sauvegarde indisponible.")));
    child.once("close", (code) => code === 0 ? accept() : reject(new Error("Échec d’un outil de sauvegarde.")));
  });
}

// Pas de shell, pas de dump en clair sur disque, pas de stderr susceptible de contenir des données.
export async function createBackup({ output, recipient, age = "age", command = ["pg_dump", ...dumpArguments], env = process.env }) {
  if (!/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(recipient ?? "")) throw new Error("Destinataire age X25519 invalide.");
  const destination = resolve(output);
  try { await stat(destination); throw new Error("La sauvegarde existe déjà."); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const partial = `${destination}.partial`;
  // wx interdit aussi d’écraser le fichier d’une autre exécution en cours.
  const file = createWriteStream(partial, { flags: "wx", mode: 0o600 });
  await new Promise((accept, reject) => { file.once("open", accept); file.once("error", reject); });
  const dump = spawn(command[0], command.slice(1), { env, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const cipher = spawn(age, ["--encrypt", "--recipient", recipient], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  try {
    await Promise.all([completion(dump), completion(cipher), pipeline(dump.stdout, cipher.stdin), pipeline(cipher.stdout, file)]);
    if ((await stat(partial)).size < 100) throw new Error("Archive chiffrée vide.");
    await link(partial, destination);
    await rm(partial);
  } catch {
    dump.kill(); cipher.kill(); file.destroy();
    await Promise.allSettled([new Promise((done) => file.closed ? done() : file.once("close", done))]);
    await rm(partial, { force: true });
    throw new Error("Sauvegarde non publiée : export ou chiffrement en échec.");
  }
  return destination;
}

export function validateDatabaseEnvironment(env) {
  if (!["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD"].every((key) => env[key])) throw new Error("Connexion PostgreSQL incomplète.");
  if (!["localhost", "127.0.0.1", "::1"].includes(env.PGHOST) && env.PGSSLMODE !== "verify-full") throw new Error("Une connexion distante exige PGSSLMODE=verify-full et une autorité de confiance.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    validateDatabaseEnvironment(process.env);
    await createBackup({ output: process.argv[2], recipient: process.env.BACKUP_RECIPIENT, age: process.env.AGE_BIN || "age" });
    console.log("Sauvegarde chiffrée créée. Sa restauration reste à vérifier.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
