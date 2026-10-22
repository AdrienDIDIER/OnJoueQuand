import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/features/auth/server";
import { readNextSession } from "@/features/sessions/queries";
import { loadWeekProgress } from "@/features/availability/server";
import { dayLabel,slotLabel } from "@/lib/time/paris";
import { loadInbox } from "@/features/notifications/server";
import { Inbox } from "@/features/notifications/ui/notifications";
import {LoadingPlaceholder} from "@/components/ui/loading";
import {WeekProgressView} from "@/features/availability/ui/progress";

async function NextSession() {
  const next=await readNextSession();
  return next?<section className="next-session" aria-label="Prochaine session"><p className="eyebrow">Prochaine partie</p><h2>{next.title}</h2><p className="session-time">{slotLabel(next.slot.starts_at,next.slot.ends_at)} · Paris</p><p>{next.response==="attending"?"Vous participez.":next.response==="declined"?"Vous ne participez pas.":"Vous venez ?"}</p><Button asChild><Link href={`/sessions?session=${next.id}#session-${next.id}`}>{next.response?"Voir la session":"Répondre à l’invitation"}<ArrowRight size={18}/></Link></Button></section>:<section className="no-session"><span className="quiet-icon"><CalendarDays size={22}/></span><h2>Une partie ensemble ?</h2><p>Choisissez un soir, les amis vous disent s’ils viennent.</p><Button asChild><Link href="/sessions">Organiser une soirée <Plus size={18}/></Link></Button></section>;
}
async function WeekProgress() {
  const {days,memberId}=await loadWeekProgress();
  return <WeekProgressView memberId={memberId} days={days.map(day=>({...day,label:dayLabel(day.local_date)}))}/>;
}
async function Notifications(){return <Inbox view={await loadInbox()}/>;}
export default async function HomePage() {
  await requireMember();
  return <div className="daily-home compact-page"><div className="page-heading"><p className="eyebrow">Votre groupe, vos soirées</p><h1>On se retrouve ?</h1></div>
    <Suspense fallback={<LoadingPlaceholder label="Votre prochaine partie…"/>}><NextSession/></Suspense>
    <Suspense fallback={<LoadingPlaceholder label="Vos disponibilités…" shape="row"/>}><WeekProgress/></Suspense>
    <Suspense fallback={null}><Notifications/></Suspense>
  </div>;
}
