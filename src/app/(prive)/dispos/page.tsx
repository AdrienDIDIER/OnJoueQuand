import type { Metadata } from "next";
import Link from "next/link";
import { loadCalendar } from "@/features/availability/server";
import { complete } from "@/features/availability/domain";
import { CopyEditor, DayEditor } from "@/features/availability/ui/editor";
import { addDays, dayLabel, intervalLabel } from "@/lib/time/paris";
import { loadGames } from "@/features/games/server";
import { MatchingSearch } from "@/features/matching/ui/search";

export const metadata: Metadata = { title: "Dispos" };
export default async function Page({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { semaine } = await searchParams;
  const state = await loadCalendar(semaine);
  const editable = state.week >= state.horizon.current;
  const catalog = editable ? await loadGames() : null;
  return <div className="availability-page"><p className="eyebrow">Le temps de se retrouver</p><h1>Vos disponibilités.</h1>
    <p>Du {dayLabel(state.week)} au {dayLabel(addDays(state.week, 6))} · Horaires de Paris</p>
    <nav aria-label="Choisir une semaine" className="week-navigation">
      {state.week > state.horizon.first && <Link href={`/dispos?semaine=${addDays(state.week, -7)}`}>← Semaine précédente</Link>}
      <Link href="/dispos">Cette semaine</Link>
      {editable && <a href="#creneaux-communs">Créneaux communs</a>}
      {addDays(state.week, 7) <= state.horizon.last && <Link href={`/dispos?semaine=${addDays(state.week, 7)}`}>Semaine suivante →</Link>}
    </nav>
    <section className="group-card"><h2>Mes réponses · {complete(state.own)}/7</h2><p>Une semaine est complète lorsque ses sept journées ont une réponse. Sans réponse ne signifie pas indisponible.</p>
      {state.own.map((d, i) => <DayEditor key={`${d.local_date}-${d.revision}-${(state.own[i + 1] ?? state.next).revision}`} day={d} next={state.own[i + 1] ?? state.next} editable={editable} quick={state.quick} />)}
    </section>
    {editable && <CopyEditor key={state.week} week={state.week} first={state.horizon.first} last={state.horizon.last} />}
    <section className="group-card"><h2>Le calendrier du groupe</h2><p>Les réponses des membres actifs, mises à jour en rechargeant la page.</p>
      <div className="calendar-scroll" role="region" aria-label="Calendrier collectif" tabIndex={0}><table className="availability-table"><caption>Semaine du {dayLabel(state.week)}</caption>
        <thead><tr><th scope="col">Membre</th>{state.own.map((d) => <th scope="col" key={d.local_date}>{dayLabel(d.local_date)}</th>)}<th scope="col">Réponses</th></tr></thead>
        <tbody>{state.calendar.map((m) => <tr key={m.id}><th scope="row">{m.name}{m.id === state.memberId ? " (vous)" : ""}</th>{m.days.map((d) => <td key={d.local_date} data-status={d.status}>
          {d.status === "unanswered" ? "— Sans réponse" : d.status === "unavailable" ? "× Indisponible" : <>✓ Disponible{d.intervals.map((r) => <span key={r.starts_at}>{intervalLabel(r.starts_at, r.ends_at, d.local_date)}</span>)}</>}
        </td>)}<td>{complete(m.days)}/7</td></tr>)}</tbody>
      </table></div>
    </section>
    {editable && catalog && <MatchingSearch key={state.week} week={state.week} last={addDays(state.week,6)} firstEditable={state.horizon.current} lastEditable={state.horizon.last} members={state.calendar.map(m=>({id:m.id,name:m.name}))} games={catalog.games.filter(g=>!g.archived_at).map(g=>({id:g.id,name:g.name}))} />}
    </div>;
}
