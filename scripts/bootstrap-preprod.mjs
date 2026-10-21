import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Cible explicite de recette ; aucune URL arbitraire ni configuration de production.
export const PROJECT_REF = "catspvwwtoyhwgnjhrix";
export function assertPreproduction(reference) {
  if (reference.trim() !== PROJECT_REF) throw new Error("Le dépôt doit être lié au projet de préproduction attendu.");
}
export function bootstrapIdentity(email, name) {
  const parsed = z.object({ email: z.email().max(254), name: z.string().min(1).max(60) }).safeParse({ email: email.trim().toLowerCase(), name: name.trim() });
  if (!parsed.success) throw new Error("Adresse e-mail ou nom invalide (nom de 1 à 60 caractères).");
  return parsed.data;
}
export function privilegedKey(data) {
  const keys = Array.isArray(data) ? data : data.api_keys ?? data.keys;
  if (!Array.isArray(keys)) throw new Error("Format de réponse Supabase non reconnu.");
  const key = keys.find((item) => item.type === "secret" && /^sb_secret_[A-Za-z0-9_-]+$/.test(item.api_key ?? ""))?.api_key
    ?? keys.find((item) => item.name === "service_role" && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(item.api_key ?? ""))?.api_key;
  if (!key) throw new Error("Clé serveur indisponible via la CLI ; vérifiez votre connexion Supabase.");
  return key;
}

function remoteAdmin() {
  assertPreproduction(readFileSync("supabase/.temp/project-ref", "utf8"));
  let keys;
  try {
    // Aucun secret dans les arguments, les journaux ou un fichier intermédiaire.
    const raw = execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "projects", "api-keys", "--project-ref", PROJECT_REF, "--reveal", "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
    keys = JSON.parse(raw);
  } catch { throw new Error("Impossible de lire la configuration serveur. Exécutez d’abord npx supabase login."); }
  return createClient(`https://${PROJECT_REF}.supabase.co`, privilegedKey(keys), { auth: { persistSession: false, autoRefreshToken: false } });
}

async function run() {
  const client = remoteAdmin();
  const memberships = await client.from("memberships").select("id").limit(1);
  if (memberships.error) throw new Error("Impossible de vérifier l’initialisation du groupe.");
  if (process.argv.includes("--check")) {
    console.log(memberships.data.length ? "Préproduction vérifiée ; groupe déjà initialisé. Aucun changement." : "Préproduction vérifiée ; groupe prêt pour le premier administrateur. Aucun changement.");
    return;
  }
  if (memberships.data.length) {
    console.log("Le groupe est déjà initialisé. Aucun compte ni rôle modifié.");
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Lancez cette commande dans votre terminal interactif.");
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let identity;
  try { identity = bootstrapIdentity(await terminal.question("Votre adresse e-mail : "), await terminal.question("Votre nom dans le groupe : ")); }
  finally { terminal.close(); }

  // Reprise après une interruption : réutiliser le compte sans confirmer son adresse.
  let user;
  for (let page = 1; page <= 20; page++) {
    const listed = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (listed.error) throw new Error("Vérification du compte Auth impossible.");
    user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === identity.email);
    if (user || listed.data.users.length < 100) break;
    if (page === 20) throw new Error("Nombre de comptes inattendu pour une première initialisation.");
  }
  if (!user) {
    const created = await client.auth.admin.createUser({ email: identity.email, email_confirm: false });
    if (created.error || !created.data.user) throw new Error("Création du compte Auth impossible. Aucun e-mail n’a été envoyé.");
    user = created.data.user;
  }
  const initialized = await client.rpc("bootstrap_admin", { account_id: user.id, display_name: identity.name });
  if (initialized.error) throw new Error("Initialisation non confirmée. Le compte Auth peut déjà exister ; relancez avec la même adresse. Aucun e-mail n’a été envoyé.");
  console.log("Premier administrateur créé. Aucun mot de passe ajouté ni adresse confirmée automatiquement. Aucun e-mail envoyé.");
  console.log("Ouvrez https://onjouequand.goriseup.eu/connexion et demandez votre code.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
