import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { localConfig } from "./local-supabase.mjs";
const config = localConfig();
const lines = [
  "NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000",
  `NEXT_PUBLIC_SUPABASE_URL=${config.url}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.key}`,
  `SUPABASE_SECRET_KEY=${config.secret}`,
  `AUTH_RATE_LIMIT_SECRET=${randomBytes(32).toString("hex")}`,
];
try { writeFileSync(".env.local", lines.join("\n") + "\n", { flag: "wx", mode: 0o600 }); }
catch { throw new Error("Création refusée : .env.local existe déjà ou n’est pas accessible. Aucun fichier remplacé."); }
console.log("Configuration locale créée dans .env.local, ignoré par Git. Aucune valeur secrète affichée.");
