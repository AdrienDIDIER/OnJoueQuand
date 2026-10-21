import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/features/auth/server";
import { readNextSession } from "@/features/sessions/queries";
import { loadWeekProgress } from "@/features/availability/server";
import { slotLabel } from "@/lib/time/paris";
import { loadInbox } from "@/features/notifications/server";
import { Inbox } from "@/features/notifications/ui/notifications";

async function NextSession() {
  const next=await readNextSession();
  return next?<section className="next-session" aria-label="Prochaine session"><p className="eyebrow">Prochaine partie</p><h2>{next.title}</h2><p className="session-time">{slotLabel(next.slot.starts_at,next.slot.ends_at)} · Paris</p><p>{next.response==="attending"?"Vous participez.":next.response==="declined"?"Vous ne participez pas.":"Vous venez ?"}</p><Button asChild><Link href={`/sessions?session=${next.id}#session-${next.id}`}>{next.response?"Voir la session":"Répondre à l’invitation"}<ArrowRight size={18}/></Link></Button></section>:<section className="no-session"><span className="quiet-icon"><CalendarDays size={22}/></span><h2>Une partie ensemble ?</h2><p>Pas encore de rendez-vous. Proposez deux horaires et laissez le groupe choisir.</p><Button asChild><Link href="/sessions">Proposer une session <Plus size={18}/></Link></Button></section>;
}
async function WeekProgress() {
  const answered=await loadWeekProgress();
  return <Link className="availability-shortcut" href="/dispos"><CalendarDays size={22} aria-hidden="true"/><span><strong>{answered===7?"Vos dispos sont à jour":"Vos soirées cette semaine"}</strong><span>{answered}/7 journées renseignées · {answered===7?"Modifier":"Compléter"}</span></span><ArrowRight size={20} aria-hidden="true"/></Link>;
}
async function Notifications(){return <Inbox view={await loadInbox()}/>;}
export default async function HomePage() {
  await requireMember();
  return <div className="daily-home compact-page"><div className="page-heading"><p className="eyebrow">Votre groupe, vos soirées</p><h1>On se retrouve ?</h1></div>
    <Suspense fallback={<div className="content-placeholder" role="status">Votre prochaine partie…</div>}><NextSession/></Suspense>
    <Suspense fallback={<div className="content-placeholder" role="status">Vos disponibilités…</div>}><WeekProgress/></Suspense>
    <Suspense fallback={null}><Notifications/></Suspense>
  </div>;
}
