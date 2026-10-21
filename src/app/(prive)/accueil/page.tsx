import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/features/auth/server";
import { readNextSession } from "@/features/sessions/queries";
import { loadWeekProgress } from "@/features/availability/server";
import { slotLabel } from "@/lib/time/paris";
import { loadInbox } from "@/features/notifications/server";
import { Inbox } from "@/features/notifications/ui/notifications";

export default async function HomePage() {
  await requireMember();
  const [next,inbox,answered]=await Promise.all([readNextSession(),loadInbox(),loadWeekProgress()]);
  return <div className="daily-home">
    <div className="page-heading"><p className="eyebrow">Votre prochain moment ensemble</p><h1>Bienvenue chez vous.</h1><p>L’essentiel pour votre prochaine partie.</p></div>
    {next&&<section className="group-card next-session" aria-label="Prochaine session"><p className="eyebrow">Prochaine session</p><h2>{next.title}</h2><p className="session-time">{slotLabel(next.slot.starts_at,next.slot.ends_at)} · Paris</p><p>{next.response==="attending"?"Vous participez.":next.response==="declined"?"Vous ne participez pas.":"Votre place attend votre réponse."}</p><Button asChild><Link href={`/sessions?session=${next.id}#session-${next.id}`}>Voir la session et répondre <ArrowRight size={18}/></Link></Button></section>}
    <section className="group-card weekly-action" aria-labelledby="week-title"><span className="quiet-icon"><CalendarDays size={22} aria-hidden="true"/></span><p className="eyebrow">Cette semaine</p><h2 id="week-title">{answered===7?"Vos dispos sont à jour.":"Un moment pour jouer ?"}</h2><p>{answered===7?"Vous pouvez encore les modifier si vos plans changent.":`${answered} journée${answered>1?"s":""} renseignée${answered>1?"s":""} sur 7. Partagez vos soirées libres avec le groupe.`}</p><Button asChild variant={next?"outline":"default"}><Link href="/dispos">{answered===7?"Voir mes dispos":"Renseigner mes dispos"}<ArrowRight size={18}/></Link></Button></section>
    {!next&&<Link href="/sessions" className="simple-row"><span><strong>Une envie de jouer ?</strong><span>Proposez une session au groupe.</span></span><ArrowRight size={20} aria-hidden="true"/></Link>}
    <Inbox view={inbox}/>
  </div>;
}
