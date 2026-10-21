import { requireAccount } from "@/features/auth/server";
import { JoinForm } from "@/features/auth/ui/forms";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function Page() {
  const { client, user } = await requireAccount();
  const { data } = await client.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (data) redirect("/accueil");
  return <main className="auth-page"><h1>Rejoindre le groupe.</h1>
    <p>Une invitation valide est nécessaire. Si votre accès a été retiré, contactez un administrateur.</p>
    <JoinForm /><form action={signOut}><Button variant="outline">Changer de compte</Button></form>
  </main>;
}
