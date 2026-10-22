"use client";
import Link from "next/link";
import {ArrowRight,CalendarDays} from "lucide-react";
import {useAvailabilityUpdates} from "../client";
import type {Day} from "../domain";

export function WeekProgressView({days,memberId}:{memberId:string;days:(Pick<Day,"local_date"|"status"|"revision">&{label:string})[]}){
  const updates=useAvailabilityUpdates();
  const current=days.map(day=>{const updated=updates.memberId===memberId?updates.days.get(day.local_date):undefined;return updated&&(updated.revision??0)>(day.revision??0)?{...day,status:updated.status,revision:updated.revision}:day;});
  const answered=current.filter(day=>day.status!=="unanswered").length;
  return <Link className="availability-shortcut" href="/dispos"><CalendarDays size={22} aria-hidden="true"/><span><strong>{answered===7?"Vos dispos sont à jour":"Vos soirées cette semaine"}</strong><span>{answered}/7 journées renseignées · {answered===7?"Modifier":"Compléter"}</span><span className="week-progress" role="img" aria-label={current.map(day=>`${day.label} : ${day.status==="available"?"dispo":day.status==="unavailable"?"indispo":"sans réponse"}`).join(" ; ")}>{current.map(day=><i key={day.local_date} data-date={day.local_date} data-status={day.status} aria-hidden="true"/>)}</span></span><ArrowRight size={20} aria-hidden="true"/></Link>;
}

export function WeekCompletion({days,memberId}:{days:Day[];memberId:string}){
  const updates=useAvailabilityUpdates();
  const answered=days.filter(day=>{const updated=updates.memberId===memberId?updates.days.get(day.local_date):undefined;return(updated&&(updated.revision??0)>(day.revision??0)?updated:day).status!=="unanswered";}).length;
  return <h2>Mes réponses · {answered}/7</h2>;
}
