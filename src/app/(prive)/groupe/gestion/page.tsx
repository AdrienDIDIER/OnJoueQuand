import { redirect } from "next/navigation";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/features/auth/server";
import { InvitationCommands, InviteForm, MemberCommands } from "@/features/group/ui/forms";

// Instant de présentation seulement ; l'expiration opposable est contrôlée en SQL.
async function presentationTime() { return Date.now(); }

export default async function Page() {
  const { client, member } = await requireMember();
  if (member.role !== "admin") redirect("/groupe");
  const now = await presentationTime();
  const [profiles, members, invitations] = await Promise.all([
    client.from("profiles").select("*"), client.from("memberships").select("*").order("joined_at"),
    member.role === "admin" ? client.from("invitations").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error || members.error || invitations.error) throw new Error("Le groupe est temporairement indisponible.");
  return <div className="group-page"><Link className="back-link" href="/groupe">← Groupe</Link><h1>Gérer le groupe.</h1>
    <section className="group-card"><h2>Les membres</h2><ul className="member-list">{members.data?.map((m) => {
      const name = profiles.data?.find((p) => p.user_id === m.user_id)?.display_name ?? "Membre";
      return <li key={m.id}><span className="avatar" aria-hidden>{name.slice(0, 2).toLocaleUpperCase("fr")}</span>
        <div><h3>{name}</h3><p>{m.role === "admin" ? "Administrateur" : "Membre"} · {m.status === "active" ? "Actif" : "Accès retiré"}</p>
          {member.role === "admin" && m.status === "active" && <MemberCommands id={m.id} revision={m.revision} role={m.role} />}</div></li>;
    })}</ul></section>
    {member.role === "admin" && <section className="group-card"><h2>Invitations</h2><InviteForm requestId={randomUUID()} />
      <ul className="member-list">{invitations.data?.map((i) => <li key={i.id}><div><h3>{i.normalized_email}</h3>
        <p>{i.status === "accepted" ? "Acceptée" : i.status === "revoked" ? "Révoquée" : i.status === "expired" || new Date(i.expires_at).getTime() <= now ? "Expirée" : "En attente"} · {i.delivery_status === "sent" ? "Code envoyé" : "Envoi à réessayer"}</p>
        {i.status === "pending" && new Date(i.expires_at).getTime() > now && <InvitationCommands id={i.id} revision={i.revision} />}</div></li>)}</ul>
    </section>}
  </div>;
}
