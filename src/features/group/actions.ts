"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/features/auth/server";
import { emailSchema, nameSchema, type ActionState } from "@/features/auth/domain";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";
import { sendEmailCode } from "@/features/auth/email-code";

const revisionSchema = z.coerce.number().int().positive();
const idSchema = z.string().uuid();
const conflict = { message: "Opération refusée : vérifiez vos droits et rechargez la page. Le dernier administrateur doit rester actif." };

async function deliver(invitationId: string, actorId: string) {
  const privileged = adminClient();
  const args = { invitation_id: invitationId, actor_id: actorId };
  const context = await privileged.rpc("provisioning_context", args);
  if (context.error || !context.data || typeof context.data !== "object" || Array.isArray(context.data)) return false;
  const email = context.data.email;
  if (typeof email !== "string") return false;
  if (!context.data.user_id) {
    // Une reprise retrouve le compte créé même si la réponse Auth a été perdue.
    await privileged.auth.admin.createUser({ email, email_confirm: false });
  }
  const fresh = await privileged.rpc("provisioning_context", args);
  if (fresh.error) return false;
  if (!fresh.data || typeof fresh.data !== "object" || Array.isArray(fresh.data) || !fresh.data.user_id) {
    await privileged.rpc("record_invitation_delivery", { ...args, delivered: false });
    return false;
  }
  const client = await userClient();
  const { error } = await sendEmailCode(client, email);
  const saved = await privileged.rpc("record_invitation_delivery", { ...args, delivered: !error });
  return !error && !saved.error;
}

export async function invite(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client, user, member } = await requireMember();
  if (member.role !== "admin") return conflict;
  const email = emailSchema.safeParse(form.get("email"));
  const request = idSchema.safeParse(form.get("requestId"));
  if (!email.success || !request.success) return { message: "Saisissez une adresse e-mail valide puis réessayez." };
  const { data, error } = await client.rpc("create_invitation", { email: email.data, request_id: request.data });
  if (error || !data) return { message: "Invitation impossible. Cette personne est peut-être déjà membre ; rechargez la page." };
  let delivered = false;
  try { delivered = await deliver(data, user.id); } catch { /* Invitation réessayable. */ }
  revalidatePath("/groupe");
  return { ok: delivered, message: delivered ? "Invitation envoyée. Elle est valable sept jours ; le code reçu est valable dix minutes." : "Invitation enregistrée, mais l’envoi reste à réessayer depuis la liste." };
}

export async function retryInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  const { user, member } = await requireMember();
  const id = idSchema.safeParse(form.get("id"));
  if (member.role !== "admin" || !id.success) return conflict;
  let ok = false;
  try { ok = await deliver(id.data, user.id); } catch { /* Réessai explicite. */ }
  revalidatePath("/groupe");
  return { ok, message: ok ? "Un nouveau code a été envoyé." : "Envoi impossible. Patientez une minute et réessayez." };
}

export async function revokeInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireMember();
  const id = idSchema.safeParse(form.get("id"));
  const revision = revisionSchema.safeParse(form.get("revision"));
  if (!id.success || !revision.success) return conflict;
  const { error } = await client.rpc("revoke_invitation", { invitation_id: id.data, expected_revision: revision.data });
  if (error) return conflict;
  revalidatePath("/groupe");
  return { ok: true, message: "Invitation révoquée." };
}

export async function saveProfile(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireMember();
  const name = nameSchema.safeParse(form.get("displayName"));
  const revision = revisionSchema.safeParse(form.get("revision"));
  if (!name.success || !revision.success) return { message: "Choisissez un nom de 1 à 60 caractères." };
  const { error } = await client.rpc("update_profile", { display_name: name.data, expected_revision: revision.data });
  if (error) return { message: "Profil modifié ou accès retiré. Rechargez la page." };
  revalidatePath("/groupe");
  return { ok: true, message: "Profil enregistré." };
}

export async function changeMember(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireMember();
  const parsed = z.object({ id: idSchema, revision: revisionSchema, role: z.enum(["admin", "member"]), status: z.enum(["active", "revoked"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return conflict;
  const { id, revision, role, status } = parsed.data;
  const { error } = await client.rpc("change_membership", { membership_id: id, expected_revision: revision, new_role: role, new_status: status });
  if (error) return conflict;
  revalidatePath("/groupe");
  return { ok: true, message: "Membre mis à jour." };
}
