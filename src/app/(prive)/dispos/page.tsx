import type { Metadata } from "next";
import { loadOwnWeek } from "@/features/availability/server";
import {WeekCompletion} from "@/features/availability/ui/progress";
import { CopyEditor, DayEditor } from "@/features/availability/ui/editor";
import { AvailabilityNavigation, WeekNavigation } from "@/features/availability/ui/navigation";
import {today} from "@/lib/time/paris";

export const metadata: Metadata = { title: "Dispos" };
export default async function Page({searchParams}:{searchParams:Promise<{semaine?:string}>}) {
  const {semaine}=await searchParams;
  const state=await loadOwnWeek(semaine),editable=state.week>=state.horizon.current;
  return <div className="availability-page compact-page"><h1>Vos disponibilités.</h1>
    <AvailabilityNavigation section="personal" week={state.week}/>
    <WeekNavigation week={state.week} first={state.horizon.first} last={state.horizon.last}/>
    <section className="week-board" aria-label="Mes disponibilités de la semaine"><div className="board-heading"><WeekCompletion days={state.own} memberId={state.memberId}/><span>{state.quick.start}–{state.quick.end}</span></div>
      <p className="board-hint">Dispo ou non ? Touchez le jour pour préciser les horaires.</p>
      {state.own.map((day,index)=><DayEditor key={`${day.local_date}-${day.revision}-${(state.own[index+1]??state.next).revision}`} day={day} next={state.own[index+1]??state.next} memberId={state.memberId} editable={editable} quick={state.quick} isToday={day.local_date===today(state.now)}/>)}
    </section>
    {editable&&<CopyEditor key={state.week} week={state.week} first={state.horizon.first} last={state.horizon.last}/>}
  </div>;
}
