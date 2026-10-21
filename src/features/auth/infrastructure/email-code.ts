import type { SupabaseClient } from "@supabase/supabase-js";

// GoTrue traite un compte non confirmé comme une inscription pour /otp.
// /resend confirme uniquement un compte déjà provisionné, sans ouvrir les inscriptions.
export async function sendEmailCode(client: Pick<SupabaseClient, "auth">, email: string) {
  const result = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (result.error?.code === "signup_disabled") return client.auth.resend({ type: "signup", email });
  return result;
}
