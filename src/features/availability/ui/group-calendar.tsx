"use client";
import {dayLabel,intervalLabel} from "@/lib/time/paris";
import {complete} from "../domain";
import {useAvailabilityUpdates} from "../client";
import type {Day} from "../domain";
import type {loadCalendar} from "../server";
export function GroupCalendar({state:initial}:{state:Awaited<ReturnType<typeof loadCalendar>>}){
  const updates=useAvailabilityUpdates();
  const latest=(day:Day)=>{const updated=updates.memberId===initial.memberId?updates.days.get(day.local_date):undefined;return updated&&(updated.revision??0)>(day.revision??0)?updated:day;};
  const state={...initial,own:initial.own.map(latest),calendar:initial.calendar.map(member=>member.id===initial.memberId?{...member,days:member.days.map(latest)}:member)};
  return <section className="calendar-view"><h2>Le calendrier du groupe</h2>
      <ul className="mobile-calendar">{state.own.map((day,index)=>{const available=state.calendar.filter(m=>m.days[index]?.status==="available");const unanswered=state.calendar.filter(m=>m.days[index]?.status==="unanswered");return <li key={day.local_date}><h3>{dayLabel(day.local_date)}</h3>{available.length?available.map(m=><p key={m.id}><strong>{m.name}</strong><span>{m.days[index]!.intervals.map(r=>intervalLabel(r.starts_at,r.ends_at,day.local_date)).join(" · ")}</span></p>):<p>Aucune disponibilité renseignée.</p>}<small>{unanswered.length} sans réponse · {state.calendar.length-available.length-unanswered.length} indisponible(s)</small></li>;})}</ul>
      <div className="calendar-scroll" role="region" aria-label="Calendrier collectif" tabIndex={0}><table className="availability-table"><caption>Semaine du {dayLabel(state.week)}</caption>
        <thead><tr><th scope="col">Membre</th>{state.own.map((d) => <th scope="col" key={d.local_date}>{dayLabel(d.local_date)}</th>)}<th scope="col">Réponses</th></tr></thead>
        <tbody>{state.calendar.map((m) => <tr key={m.id}><th scope="row">{m.name}{m.id === state.memberId ? " (vous)" : ""}</th>{m.days.map((d) => <td key={d.local_date} data-status={d.status}>
          {d.status === "unanswered" ? "— Sans réponse" : d.status === "unavailable" ? "× Indisponible" : <>✓ Disponible{d.intervals.map((r) => <span key={r.starts_at}>{intervalLabel(r.starts_at, r.ends_at, d.local_date)}</span>)}</>}
        </td>)}<td>{complete(m.days)}/7</td></tr>)}</tbody>
      </table></div>
    </section>;}
