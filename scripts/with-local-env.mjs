import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { localConfig } from "./local-supabase.mjs";
const config = localConfig();
const args = process.argv.slice(2);
if (!args.length) throw new Error("Indiquer le script Node à exécuter.");
const child = spawn(process.execPath, args, { stdio: "inherit", env: {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: config.url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.key,
  SUPABASE_SECRET_KEY: config.secret,
  AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
} });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", () => { console.error("Impossible de lancer la commande locale."); process.exit(1); });
