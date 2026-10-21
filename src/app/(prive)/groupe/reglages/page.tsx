import Link from "next/link";
import { requireMember } from "@/features/auth/server";
import { signOut } from "@/features/auth/actions";
import { ProfileForm } from "@/features/group/ui/forms";
import { loadNotificationSettings } from "@/features/notifications/server";
import { NotificationSettings } from "@/features/notifications/ui/notifications";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const {client,user}=await requireMember();
  const [profile,notifications]=await Promise.all([client.from("profiles").select("display_name,revision").eq("user_id",user.id).single(),loadNotificationSettings()]);
  if(profile.error) throw new Error("Votre profil est temporairement indisponible.");
  return <div className="group-page"><Link className="back-link" href="/groupe">← Groupe</Link><h1>Mes réglages.</h1>
    <NotificationSettings view={notifications}/>
    <details className="group-card disclosure"><summary>Mon profil</summary><div className="disclosure-body"><ProfileForm name={profile.data.display_name} revision={profile.data.revision}/></div></details>
    <form action={signOut} className="signout"><Button variant="outline">Me déconnecter</Button></form>
  </div>;
}
