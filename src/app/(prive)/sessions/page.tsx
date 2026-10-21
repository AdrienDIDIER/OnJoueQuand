import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadSessions } from "@/features/sessions/server";
import { ProposalForm, SessionCard } from "@/features/sessions/ui/sessions";
export const metadata: Metadata = { title: "Sessions" };
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const params=await searchParams;
  const page=/^\d{1,5}$/.test(params.page??"")?Number(params.page):0;
  const view=await loadSessions(page);
  const cardView={now:view.now,member:view.member,people:view.people,games:view.games};
  return <>
    <div className="page-heading"><p className="eyebrow">ON SE DONNE RENDEZ-VOUS</p><h1>Vos sessions<span className="text-primary">.</span></h1><p>Proposez, votez, puis confirmez votre participation.</p></div>
    <section className="group-card"><h2>Une envie de jouer ?</h2><details><summary>Proposer une session</summary><ProposalForm games={view.games} now={view.now} requestId={randomUUID()}/></details></section>
    <div className="session-list">{view.sessions.map(s=><SessionCard key={`${s.id}-${s.revision}-${s.ownBallot?.revision??0}-${s.ownRsvp?.revision??0}`} session={s} view={cardView}/>)}</div>
    {!view.sessions.length&&<p>Aucune session sur cette page. Lancez une proposition pour votre groupe.</p>}
    <nav aria-label="Pages des sessions" className="session-pagination">{page>0&&<Link href={`/sessions?page=${page-1}`}>Sessions plus récentes</Link>}{view.sessions.length===20&&<Link href={`/sessions?page=${page+1}`}>Sessions plus anciennes</Link>}</nav>
  </>;
}
