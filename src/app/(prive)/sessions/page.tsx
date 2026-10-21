import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadSessions } from "@/features/sessions/server";
import { SessionCard } from "@/features/sessions/ui/sessions";
import {EveningForm} from "@/features/sessions/ui/evening";
import { Sheet } from "@/components/ui/sheet";
export const metadata: Metadata = { title: "Soirées" };
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;session?:string;soir?:string}>}) {
  const params=await searchParams;
  const page=/^\d{1,5}$/.test(params.page??"")?Number(params.page):0;
  const focused=params.session!==undefined;
  const selected=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.session??"")?params.session:undefined;
  const view=await loadSessions(page,focused?(selected??"00000000-0000-0000-0000-000000000000"):undefined);
  const cardView={now:view.now,member:view.member,people:view.people,games:view.games};
  const history=focused?[]:view.sessions.filter(s=>["completed","cancelled","expired"].includes(s.status));
  const current=focused?view.sessions:view.sessions.filter(s=>!["completed","cancelled","expired"].includes(s.status));
  return <>
    <div className="page-heading page-with-action"><h1>Vos soirées<span className="text-primary">.</span></h1><Sheet defaultOpen={params.soir!==undefined} title="Organiser une soirée" trigger={<span className="primary-trigger">+ Organiser une soirée</span>}><EveningForm games={view.games} now={view.now} requestId={randomUUID()} day={/^\d{4}-\d{2}-\d{2}$/.test(params.soir??"")?params.soir:undefined}/></Sheet></div>
    <div className="session-list">{current.map(s=><SessionCard key={`${s.id}-${s.revision}-${s.ownBallot?.revision??0}-${s.ownRsvp?.revision??0}`} session={s} view={cardView}/>)}</div>
    {history.length>0&&<details className="group-card disclosure"><summary>Soirées passées et annulées · {history.length}</summary><div className="session-list">{history.map(s=><SessionCard key={`${s.id}-${s.revision}`} session={s} view={cardView}/>)}</div></details>}
    {!view.sessions.length&&<p>{focused?"Cette soirée n’est plus disponible.":"Pas encore de soirée. Choisissez un soir pour vous retrouver."}</p>}
    {focused?<Link href="/sessions">Voir toutes les soirées</Link>:<nav aria-label="Pages des soirées" className="session-pagination">{page>0&&<Link href={`/sessions?page=${page-1}`}>Soirées plus récentes</Link>}{view.sessions.length===20&&<Link href={`/sessions?page=${page+1}`}>Soirées plus anciennes</Link>}</nav>}
  </>;
}
