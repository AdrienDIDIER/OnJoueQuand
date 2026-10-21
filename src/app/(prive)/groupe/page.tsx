import { randomUUID } from "node:crypto";
import { requireMember } from "@/features/auth/server";
import { InvitationCommands, InviteForm, MemberCommands, ProfileForm } from "@/features/group/ui/forms";
import { loadGames } from "@/features/games/server";
import { Catalog } from "@/features/games/ui/catalog";
import {loadNotificationSettings} from "@/features/notifications/server";
import {NotificationSettings} from "@/features/notifications/ui/notifications";

// Instant de présentation seulement ; l'expiration opposable est contrôlée en SQL.
async function presentationTime() { return Date.now(); }

export default async function Page() {
  const { client, user, member } = await requireMember();
  const now = await presentationTime();
  const [catalog, notifications, profiles, members, invitations] = await Promise.all([
    loadGames(), loadNotificationSettings(),
    client.from("profiles").select("*"), client.from("memberships").select("*").order("joined_at"),
    member.role === "admin" ? client.from("invitations").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error || members.error || invitations.error) throw new Error("Le groupe est temporairement indisponible.");
  const own = profiles.data?.find((p) => p.user_id === user.id);
  return <div className="group-page"><p className="eyebrow">Votre cercle privé</p><h1>Votre groupe.</h1>
    <section className="group-card"><h2>Mon profil</h2>{own && <ProfileForm name={own.display_name} revision={own.revision} />}</section>
    <section className="group-card"><h2>Les membres</h2><ul className="member-list">{members.data?.map((m) => {
      const name = profiles.data?.find((p) => p.user_id === m.user_id)?.display_name ?? "Membre";
      return <li key={m.id}><span className="avatar" aria-hidden>{name.slice(0, 2).toLocaleUpperCase("fr")}</span>
        <div><h3>{name}</h3><p>{m.role === "admin" ? "Administrateur" : "Membre"} · {m.status === "active" ? "Actif" : "Accès retiré"}</p>
          {member.role === "admin" && m.status === "active" && <MemberCommands id={m.id} revision={m.revision} role={m.role} />}</div></li>;
    })}</ul></section>
    <Catalog games={catalog.games} memberId={member.id} admin={member.role==="admin"} requestId={randomUUID()} />
    <NotificationSettings view={notifications}/>
    {member.role === "admin" && <section className="group-card"><h2>Invitations</h2><InviteForm requestId={randomUUID()} />
      <ul className="member-list">{invitations.data?.map((i) => <li key={i.id}><div><h3>{i.normalized_email}</h3>
        <p>{i.status === "accepted" ? "Acceptée" : i.status === "revoked" ? "Révoquée" : i.status === "expired" || new Date(i.expires_at).getTime() <= now ? "Expirée" : "En attente"} · {i.delivery_status === "sent" ? "Code envoyé" : "Envoi à réessayer"}</p>
        {i.status === "pending" && new Date(i.expires_at).getTime() > now && <InvitationCommands id={i.id} revision={i.revision} />}</div></li>)}</ul>
    </section>}
  </div>;
}
