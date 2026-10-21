"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvitation, requestCode, verifyCode } from "../actions";
import { initialState } from "../domain";

export function LoginForms() {
  const [sent, send, sending] = useActionState(requestCode, initialState);
  const [verified, verify, verifying] = useActionState(verifyCode, initialState);
  return <div className="auth-forms">
    <form action={send} className="form-stack">
      <h2>Recevoir un code</h2>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <Button disabled={sending}>{sending ? "Envoi en cours…" : "Recevoir mon code"}</Button>
      <p role="status">{sent.message}</p>
    </form>
    <form action={verify} className="form-stack">
      <h2>J’ai reçu mon code</h2>
      <label>Adresse e-mail du code<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Code à six chiffres<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>
      <Button disabled={verifying}>{verifying ? "Vérification…" : "Me connecter"}</Button>
      <p role="status">{verified.message}</p>
    </form>
  </div>;
}

export function JoinForm() {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return <form action={action} className="form-stack">
    <label>Votre nom dans le groupe<input name="displayName" autoComplete="nickname" required maxLength={60} /></label>
    <Button disabled={pending}>Accepter mon invitation</Button>
    <p role="status">{state.message}</p>
  </form>;
}
