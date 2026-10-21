import { loadCalendar } from "@/features/availability/server";
import { AvailabilityNavigation, WeekNavigation } from "@/features/availability/ui/navigation";
import { loadGameChoices } from "@/features/games/server";
import { MatchingSearch } from "@/features/matching/ui/search";
import { addDays } from "@/lib/time/paris";

export default async function Page({searchParams}:{searchParams:Promise<{semaine?:string}>}) {
  const {semaine}=await searchParams;
  const [state,games]=await Promise.all([loadCalendar(semaine),loadGameChoices()]);
  const editable=state.week>=state.horizon.current;
  return <div className="availability-page compact-page"><h1>On joue quand ?</h1><AvailabilityNavigation section="matching" week={state.week}/><WeekNavigation base="/dispos/trouver" week={state.week} first={state.horizon.first} last={state.horizon.last}/>{editable?<MatchingSearch week={state.week} last={addDays(state.week,6)} firstEditable={state.horizon.current} lastEditable={state.horizon.last} members={state.calendar.map(m=>({id:m.id,name:m.name}))} games={games}/>:<p>Choisissez une semaine à venir pour chercher un créneau.</p>}</div>;
}
