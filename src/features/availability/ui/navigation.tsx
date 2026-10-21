import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dayLabel } from "@/lib/time/paris";

export function AvailabilityNavigation({section,week}:{section:"personal"|"group"|"matching";week:string}) {
  return <nav className="section-tabs" aria-label="Vue des disponibilités">{[
    {id:"personal",href:"/dispos",label:"Mes dispos"},
    {id:"group",href:"/dispos/groupe",label:"Le groupe"},
    {id:"matching",href:"/dispos/trouver",label:"Trouver un soir"},
  ].map(item=><Link key={item.id} href={`${item.href}?semaine=${week}`} aria-current={section===item.id?"page":undefined}>{item.label}</Link>)}</nav>;
}

export function WeekNavigation({week,first,last,base="/dispos"}:{week:string;first:string;last:string;base?:string}) {
  const start=dayLabel(week).split(" ")[1],end=dayLabel(addDays(week,6)).split(" ").slice(1).join(" ");
  return <nav className="week-switcher" aria-label="Choisir une semaine">
    {week>first?<Link href={`${base}?semaine=${addDays(week,-7)}`} aria-label="Semaine précédente"><ChevronLeft size={20}/></Link>:<span/>}
    <Link href={base} aria-label="Revenir à cette semaine">{start}–{end}<span>Heure de Paris</span></Link>
    {addDays(week,7)<=last?<Link href={`${base}?semaine=${addDays(week,7)}`} aria-label="Semaine suivante"><ChevronRight size={20}/></Link>:<span/>}
  </nav>;
}
