import { LoginForms } from "@/features/auth/ui/forms";
import { getPublicEnv } from "@/lib/env/server";

export default function Page() {
  return <main className="auth-page"><p className="eyebrow">OnJoueQuand · Groupe privé</p>
    <h1>Content de vous retrouver.</h1><p>Connectez-vous avec votre adresse invitée. Aucun mot de passe à retenir.</p>
    {getPublicEnv().supabase ? <LoginForms /> : <p role="status">La connexion n’est pas encore configurée. Contactez la personne qui gère l’application.</p>}
  </main>;
}
