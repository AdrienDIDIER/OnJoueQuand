import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Change, Guard } from "./domain";
export type Preview = { actor: string; expires: number; changes: Change[]; guards: Guard[] };
function key() { const key = process.env.AUTH_RATE_LIMIT_SECRET; if (!key || key.length < 32) throw new Error("Configuration de validation indisponible."); return key; }
function mac(data: string) { return createHmac("sha256", key()).update(`availability-preview:${data}`).digest("base64url"); }
export function signPreview(value: Preview) { const data = Buffer.from(JSON.stringify(value)).toString("base64url"); return `${data}.${mac(data)}`; }
export function readPreview(token: string, actor: string, now: number): Preview {
  if (token.length > 100_000) throw new Error("Aperçu invalide.");
  const [data, signature] = token.split(".");
  if (!data || !signature) throw new Error("Refaites l’aperçu.");
  const expected = Buffer.from(mac(data)); const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Aperçu invalide. Rechargez la page.");
  const value = JSON.parse(Buffer.from(data, "base64url").toString()) as Preview;
  if (value.actor !== actor || value.expires <= now) throw new Error("Cet aperçu a expiré. Refaites-le avant de confirmer.");
  return value;
}
