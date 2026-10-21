import { spawn } from "node:child_process";
import { createECDH,randomBytes } from "node:crypto";
import { localConfig } from "./local-supabase.mjs";
const config = localConfig();
// Clé publique de recette uniquement ; aucune clé privée VAPID pour les envois réels.
const pushKey=createECDH("prime256v1");pushKey.generateKeys();
const args = process.argv.slice(2);
if (!args.length) throw new Error("Indiquer le script Node à exécuter.");
const child = spawn(process.execPath, args, { stdio: "inherit", env: {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: config.url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.key,
  SUPABASE_SECRET_KEY: config.secret,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: pushKey.getPublicKey().toString("base64url"),
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  JOBS_SECRET: randomBytes(32).toString("hex"),
} });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", () => { console.error("Impossible de lancer la commande locale."); process.exit(1); });
