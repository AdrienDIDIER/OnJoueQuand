"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialState, type ActionState } from "@/features/auth/domain";
import { changeMember, invite, retryInvitation, revokeInvitation, saveProfile } from "../actions";

function Command({ action, fields, label }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; fields: Record<string, string | number>; label: string }) {
  const [state, submit, pending] = useActionState(action, initialState);
  return <form action={submit} className="form-stack">
    {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <Button variant="outline" disabled={pending}>{label}</Button><p role="status">{state.message}</p>
  </form>;
}
export function ProfileForm({ name, revision }: { name: string; revision: number }) {
  const [state, action, pending] = useActionState(saveProfile, initialState);
  return <form action={action} className="form-stack"><input type="hidden" name="revision" value={revision} />
    <label>Votre nom dans le groupe<input name="displayName" defaultValue={name} required maxLength={60} /></label>
    <Button disabled={pending}>Enregistrer mon profil</Button><p role="status">{state.message}</p></form>;
}
export function InviteForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(invite, initialState);
  return <form action={action} className="form-stack"><input type="hidden" name="requestId" value={requestId} />
    <label>Adresse e-mail à inviter<input name="email" type="email" required maxLength={254} /></label>
    <Button disabled={pending}>Inviter cette personne</Button><p role="status">{state.message}</p></form>;
}
export function InvitationCommands({ id, revision }: { id: string; revision: number }) {
  return <div className="command-row"><Command action={retryInvitation} fields={{ id }} label="Renvoyer un code" />
    <Command action={revokeInvitation} fields={{ id, revision }} label="Révoquer l’invitation" /></div>;
}
export function MemberCommands({ id, revision, role }: { id: string; revision: number; role: string }) {
  return <div className="command-row"><Command action={changeMember} fields={{ id, revision, role: role === "admin" ? "member" : "admin", status: "active" }} label={role === "admin" ? "Passer membre" : "Nommer administrateur"} />
    <Command action={changeMember} fields={{ id, revision, role, status: "revoked" }} label="Retirer l’accès" /></div>;
}
