"use server";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPublicEnv } from "@/lib/env/server";
import { userClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireAccount } from "./server";
import { sendEmailCode } from "./infrastructure/email-code";
import { codeSchema, emailSchema, nameSchema, type ActionState } from "./domain";

async function allowed(email: string, kind: string, maximum: number) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) return false;
  const client = adminClient();
  const h = await headers();
  // Vercel écrase cet en-tête ; hors Vercel, budget réseau global, jamais une IP fournie librement.
  const network = process.env.VERCEL === "1" ? h.get("x-vercel-forwarded-for") ?? "unknown" : "local";
  for (const [value, limit] of [[`${kind}:email:${email}`, maximum], [`${kind}:network:${network}`, 100]] as const) {
    const key_hash = createHmac("sha256", secret).update(value).digest("hex");
    const { data, error } = await client.rpc("consume_auth_limit", { key_hash, max_attempts: limit });
    if (error || !data) return false;
  }
  return true;
}

export async function requestCode(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { message: "Saisissez une adresse e-mail valide." };
  try {
    if (await allowed(email.data, "send", 5)) {
      const client = await userClient();
      await sendEmailCode(client, email.data);
    }
  } catch { /* Même réponse pour une adresse inconnue, une limite ou une panne SMTP. */ }
  return { ok: true, message: "Si cette adresse est autorisée, un code vous sera envoyé. Vérifiez votre boîte e-mail ; patientez une minute avant de réessayer." };
}

export async function verifyCode(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = codeSchema.safeParse(form.get("code"));
  const failure = { message: "Code invalide ou expiré. Vérifiez votre saisie ou demandez un nouveau code." };
  if (!email.success || !code.success) return failure;
  try {
    if (!(await allowed(email.data, "verify", 10))) return failure;
    const client = await userClient();
    const { error } = await client.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
    if (error) return failure;
  } catch { return failure; }
  redirect("/accueil");
}

export async function acceptInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAccount();
  const name = nameSchema.safeParse(form.get("displayName"));
  if (!name.success) return { message: "Choisissez un nom de 1 à 60 caractères." };
  const { error } = await client.rpc("accept_invitation", { display_name: name.data });
  if (error) return { message: "Aucune invitation valide pour ce compte. Contactez un administrateur." };
  redirect("/accueil");
}

export async function signOut() {
  if (getPublicEnv().supabase) {
    const client = await userClient();
    await client.auth.signOut({ scope: "local" });
  }
  redirect("/connexion");
}
