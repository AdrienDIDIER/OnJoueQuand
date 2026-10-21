import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Gamepad2, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/features/auth/server";

export default async function HomePage() {
  await requireMember();
  return <>
    <div className="page-heading"><p className="eyebrow">ON SE RETROUVE EN JEU ?</p><h1>Bienvenue chez vous<span className="text-primary">.</span></h1><p>Le point de départ de vos prochaines soirées ensemble.</p></div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><span className="hero-label"><span /> LE BON CRÉNEAU CHANGE TOUT</span><h2 id="hero-title">Moins de messages.<br /><span>Plus de parties.</span></h2><p>Vos dispos, vos jeux, votre groupe.<br />Tout pour se retrouver au même moment.</p><div className="hero-actions"><Button asChild><Link href="/dispos">Découvrir les dispos <ArrowRight aria-hidden="true" /></Link></Button><Button asChild variant="outline"><Link href="/sessions">Voir les sessions</Link></Button></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="game-tile"><Gamepad2 size={66} strokeWidth={1.2} /></div><span className="orbit-symbol symbol-calendar"><CalendarDays size={24} /></span><span className="orbit-symbol symbol-check"><Check size={23} /></span><span className="orbit-symbol symbol-people"><Users size={23} /></span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /></div>
    </section>
    <div className="section-heading"><h2>Une soirée réussie, en trois temps</h2><span>Simple, du début à la partie.</span></div>
    <div className="steps-grid">{[
      { n: "01", icon: CalendarDays, title: "Trouvez votre moment", text: "Un soir de libre ou un créneau précis : chacun pourra partager ses disponibilités.", href: "/dispos", label: "Les disponibilités" },
      { n: "02", icon: Swords, title: "Donnez-vous rendez-vous", text: "Un jeu, plusieurs horaires et l’avis du groupe pour choisir le bon créneau.", href: "/sessions", label: "Les sessions" },
      { n: "03", icon: Users, title: "Retrouvez votre équipe", text: "Vos amis, vos collègues et vos jeux favoris, réunis dans un espace privé.", href: "/groupe", label: "Le groupe" },
    ].map(({ n, icon: Icon, title, text, href, label }) => <Card key={n} className="step-card"><div className="step-top"><span className="step-icon"><Icon size={22} aria-hidden="true" /></span><span className="step-number">{n}</span></div><h3>{title}</h3><p>{text}</p><Link href={href} className="text-link">{label}<ArrowRight size={16} aria-hidden="true" /></Link></Card>)}</div>
    <div className="welcome-note"><span className="note-line" /><p><strong>Votre espace prend forme.</strong> Les invitations et l’organisation de vos parties seront bientôt disponibles.</p></div>
  </>;
}
