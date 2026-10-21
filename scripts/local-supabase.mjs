import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export function localConfig() {
  const raw = execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const data = JSON.parse(raw);
  if (new URL(data.API_URL).hostname !== "127.0.0.1" || new URL(data.API_URL).port !== "55321") throw new Error("Cette commande exige le projet local OnJoueQuand sur le port 55321.");
  return { url: data.API_URL, key: data.ANON_KEY, secret: data.SERVICE_ROLE_KEY, mailUrl: data.INBUCKET_URL ?? "http://127.0.0.1:55324" };
}
export function clients(config = localConfig()) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return { config, admin: createClient(config.url, config.secret, options), anonymous: () => createClient(config.url, config.key, options) };
}
export function checked(result) {
  if (result.error) throw new Error(`Échec Supabase : ${result.error.code ?? "inconnu"} ${result.error.message}`);
  return result.data;
}
export async function identity(admin, anonymous, label, confirmed = true) {
  const email = `${label}-${randomUUID()}@example.test`;
  const { user } = checked(await admin.auth.admin.createUser({ email, email_confirm: confirmed }));
  const client = anonymous();
  if (confirmed) {
    const link = checked(await admin.auth.admin.generateLink({ type: "magiclink", email }));
    checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" }));
  }
  return { email, user, client };
}
export function extractMailboxCode(message) {
  // Lire le texte visible, pas les chiffres présents dans les couleurs et attributs HTML.
  const body = message.Text || (message.HTML ?? "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return body.match(/\b\d{6}\b/)?.[0];
}
export async function mailboxCode(mailUrl, email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (response.ok) {
      const { messages } = await response.json();
      if (messages.length) {
        const message = await (await fetch(`${mailUrl}/api/v1/message/${messages[0].ID}`)).json();
        const code = extractMailboxCode(message);
        if (code) return code;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Code absent de la boîte locale.");
}
