import Link from "next/link";
import { ChevronRight, Gamepad2, Settings, UserPlus } from "lucide-react";
import { requireMember } from "@/features/auth/server";

export default async function Page() {
  const {client,member}=await requireMember();
  const [profiles,members]=await Promise.all([client.from("profiles").select("user_id,display_name"),client.from("memberships").select("id,user_id").eq("status","active").order("joined_at")]);
  if(profiles.error||members.error) throw new Error("Le groupe est temporairement indisponible.");
  return <div className="group-page"><p className="eyebrow">Votre cercle privé</p><h1>Votre groupe.</h1><p className="page-intro">{members.data.length} personne{members.data.length>1?"s":""}, des jeux et du temps ensemble.</p>

    <section className="group-card"><h2>Les membres</h2><ul className="member-list">{members.data.map(m=>{const name=profiles.data.find(p=>p.user_id===m.user_id)?.display_name??"Membre";return <li key={m.id}><span className="avatar" aria-hidden="true">{name.slice(0,2).toLocaleUpperCase("fr")}</span><div><h3>{name}</h3>{m.id===member.id&&<p>Vous</p>}</div></li>;})}</ul></section>
        <nav className="group-shortcuts" aria-label="Dans le groupe">
      <Link className="simple-row" href="/groupe/jeux"><Gamepad2 aria-hidden="true"/><span><strong>Les jeux du groupe</strong><span>Retrouvez vos favoris.</span></span><ChevronRight aria-hidden="true"/></Link>
      <Link className="simple-row" href="/groupe/reglages"><Settings aria-hidden="true"/><span><strong>Mes réglages</strong><span>Notifications et profil.</span></span><ChevronRight aria-hidden="true"/></Link>
      {member.role==="admin"&&<Link className="simple-row" href="/groupe/gestion"><UserPlus aria-hidden="true"/><span><strong>Gérer le groupe</strong><span>Inviter et gérer les accès.</span></span><ChevronRight aria-hidden="true"/></Link>}
    </nav>
  </div>;
}
