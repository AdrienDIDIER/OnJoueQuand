import { loadCalendar } from "@/features/availability/server";
import { GroupCalendar } from "@/features/availability/ui/group-calendar";
import { AvailabilityNavigation, WeekNavigation } from "@/features/availability/ui/navigation";

export default async function Page({searchParams}:{searchParams:Promise<{semaine?:string}>}) {
  const {semaine}=await searchParams;
  const state=await loadCalendar(semaine);
  return <div className="availability-page compact-page"><h1>Les dispos du groupe.</h1><AvailabilityNavigation section="group" week={state.week}/><WeekNavigation base="/dispos/groupe" week={state.week} first={state.horizon.first} last={state.horizon.last}/><GroupCalendar state={state}/></div>;
}
