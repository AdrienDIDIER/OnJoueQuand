import Link from "next/link";
import { ArrowLeft, CalendarDays, Swords, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const icons = { calendar: CalendarDays, sessions: Swords, group: Users };

export function ComingSoon({ title, subtitle, icon, headline, description, details }: { title: string; subtitle: string; icon: keyof typeof icons; headline: string; description: string; details: readonly string[] }) {
  const Icon = icons[icon];
  return <>
    <div className="page-heading"><p className="eyebrow">VOTRE PROCHAIN RENDEZ-VOUS COMMENCE ICI</p><h1>{title}<span className="text-primary">.</span></h1><p>{subtitle}</p></div>
    <Card className="empty-state"><span className="empty-icon"><Icon size={38} strokeWidth={1.4} aria-hidden="true" /></span><span className="status-pill">Bientôt disponible</span><h2>{headline}</h2><p>{description}</p><Button asChild variant="outline"><Link href="/accueil"><ArrowLeft aria-hidden="true" />Retour à l’accueil</Link></Button></Card>
    <section className="planned-section" aria-label="À venir"><p className="eyebrow">BIENTÔT DANS CET ESPACE</p><ul>{details.map((detail, index) => <li key={detail}><span aria-hidden="true">0{index + 1}</span>{detail}</li>)}</ul></section>
  </>;
}
