import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Gamepad2, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/features/auth/server";
import { readNextSession } from "@/features/sessions/queries";
import { slotLabel } from "@/lib/time/paris";
import {loadInbox} from "@/features/notifications/server";
import {Inbox} from "@/features/notifications/ui/notifications";

export default async function HomePage() {
  await requireMember();
  const [next,inbox]=await Promise.all([readNextSession(),loadInbox()]);
  return <>
    <div className="page-heading"><p className="eyebrow">ON SE RETROUVE EN JEU ?</p><h1>Bienvenue chez vous<span className="text-primary">.</span></h1><p>Le point de départ de vos prochaines soirées ensemble.</p></div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><span className="hero-label"><span /> LE BON CRÉNEAU CHANGE TOUT</span><h2 id="hero-title">Moins de messages.<br /><span>Plus de parties.</span></h2><p>Vos dispos, vos jeux, votre groupe.<br />Tout pour se retrouver au même moment.</p><div className="hero-actions"><Button asChild><Link href="/dispos">Découvrir les dispos <ArrowRight aria-hidden="true" /></Link></Button><Button asChild variant="outline"><Link href="/sessions">Voir les sessions</Link></Button></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="game-tile"><Gamepad2 size={66} strokeWidth={1.2} /></div><span className="orbit-symbol symbol-calendar"><CalendarDays size={24} /></span><span className="orbit-symbol symbol-check"><Check size={23} /></span><span className="orbit-symbol symbol-people"><Users size={23} /></span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /></div>
    </section>
    {next&&<section className="group-card" aria-label="Prochaine session"><p className="eyebrow">PROCHAINE SESSION</p><h2>{next.title}</h2><p>{slotLabel(next.slot.starts_at,next.slot.ends_at)} · Paris</p><p>{next.response==="attending"?"Vous participez.":next.response==="declined"?"Vous ne participez pas.":"Votre participation attend une réponse explicite."}</p><Link className="text-link" href={`/sessions#session-${next.id}`}>Voir la session et répondre <ArrowRight size={16}/></Link></section>}
    <div className="section-heading"><h2>Une soirée réussie, en trois temps</h2><span>Simple, du début à la partie.</span></div>
    <div className="steps-grid">{[
      { n: "01", icon: CalendarDays, title: "Trouvez votre moment", text: "Un soir de libre ou un créneau précis : chacun pourra partager ses disponibilités.", href: "/dispos", label: "Les disponibilités" },
      { n: "02", icon: Swords, title: "Donnez-vous rendez-vous", text: "Un jeu, plusieurs horaires et l’avis du groupe pour choisir le bon créneau.", href: "/sessions", label: "Les sessions" },
      { n: "03", icon: Users, title: "Retrouvez votre équipe", text: "Vos amis, vos collègues et vos jeux favoris, réunis dans un espace privé.", href: "/groupe", label: "Le groupe" },
    ].map(({ n, icon: Icon, title, text, href, label }) => <Card key={n} className="step-card"><div className="step-top"><span className="step-icon"><Icon size={22} aria-hidden="true" /></span><span className="step-number">{n}</span></div><h3>{title}</h3><p>{text}</p><Link href={href} className="text-link">{label}<ArrowRight size={16} aria-hidden="true" /></Link></Card>)}</div>
    <Inbox view={inbox}/>
    <div className="welcome-note"><span className="note-line" /><p><strong>À vous de jouer.</strong> Partagez vos disponibilités, proposez une soirée et confirmez votre participation.</p></div>
  </>;
}
