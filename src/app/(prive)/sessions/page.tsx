import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadSessions } from "@/features/sessions/server";
import { ProposalForm, SessionCard } from "@/features/sessions/ui/sessions";
import { Sheet } from "@/components/ui/sheet";
export const metadata: Metadata = { title: "Sessions" };
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;session?:string}>}) {
  const params=await searchParams;
  const page=/^\d{1,5}$/.test(params.page??"")?Number(params.page):0;
  const focused=params.session!==undefined;
  const selected=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.session??"")?params.session:undefined;
  const view=await loadSessions(page,focused?(selected??"00000000-0000-0000-0000-000000000000"):undefined);
  const cardView={now:view.now,member:view.member,people:view.people,games:view.games};
  const history=focused?[]:view.sessions.filter(s=>["completed","cancelled","expired"].includes(s.status));
  const current=focused?view.sessions:view.sessions.filter(s=>!["completed","cancelled","expired"].includes(s.status));
  return <>
    <div className="page-heading page-with-action"><h1>Vos sessions<span className="text-primary">.</span></h1><Sheet title="Proposer une session" trigger={<span className="primary-trigger">+ Proposer une session</span>}><ProposalForm games={view.games} now={view.now} requestId={randomUUID()}/></Sheet></div>
    <div className="session-list">{current.map(s=><SessionCard key={`${s.id}-${s.revision}-${s.ownBallot?.revision??0}-${s.ownRsvp?.revision??0}`} session={s} view={cardView}/>)}</div>
    {history.length>0&&<details className="group-card disclosure"><summary>Sessions passées et annulées · {history.length}</summary><div className="session-list">{history.map(s=><SessionCard key={`${s.id}-${s.revision}`} session={s} view={cardView}/>)}</div></details>}
    {!view.sessions.length&&<p>{focused?"Cette session n’est plus disponible.":"Aucune session sur cette page. Lancez une proposition pour votre groupe."}</p>}
    {focused?<Link href="/sessions">Voir toutes les sessions</Link>:<nav aria-label="Pages des sessions" className="session-pagination">{page>0&&<Link href={`/sessions?page=${page-1}`}>Sessions plus récentes</Link>}{view.sessions.length===20&&<Link href={`/sessions?page=${page+1}`}>Sessions plus anciennes</Link>}</nav>}
  </>;
}
