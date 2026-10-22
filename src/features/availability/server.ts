import "server-only";
import { cache } from "react";
import { requireMember } from "@/features/auth/server";
import { emptyDay, horizon, normalize, weekDays, type Day } from "./domain";
import { addDays, monday } from "@/lib/time/paris";

export const loadOwnWeek = cache(async function loadOwnWeek(requested?: string) {
  const {client,member}=await requireMember();
  const now=new Date().toISOString(),h=horizon(now),week=requested??h.current;
  if(monday(week)!==week||week<h.first||week>h.last)throw new Error("Cette semaine n’est pas disponible.");
  const [days,group]=await Promise.all([
    client.from("availability_days").select("*, availability_intervals(starts_at,ends_at)").eq("membership_id",member.id).gte("local_date",week).lte("local_date",addDays(week,7)),
    client.from("groups").select("quick_start,quick_end").single(),
  ]);
  if(days.error||group.error)throw new Error("Vos disponibilités sont temporairement indisponibles.");
  const day=(date:string):Day=>{const row=days.data.find(r=>r.local_date===date);return row?{local_date:date,status:row.status as Day["status"],mode:row.mode as Day["mode"],revision:row.revision,intervals:normalize(row.availability_intervals)}:emptyDay(date);};
  return{now,week,horizon:h,memberId:member.id,own:weekDays(week).map(day),next:day(addDays(week,7)),quick:{start:group.data.quick_start.slice(0,5),end:group.data.quick_end.slice(0,5)}};
});

export async function loadWeekProgress() {
  const { client, member } = await requireMember();
  const week = horizon(new Date().toISOString()).current;
  const { data, error } = await client.from("availability_days").select("local_date,status,revision").eq("membership_id", member.id).gte("local_date", week).lte("local_date", addDays(week, 6));
  if (error) throw new Error("Vos disponibilités sont temporairement indisponibles.");
  const days=weekDays(week).map(local_date=>{const day=data.find(day=>day.local_date===local_date);return{local_date,status:(day?.status??"unanswered") as Day["status"],revision:day?.revision??null};});
  return {answered:days.filter(day=>day.status!=="unanswered").length,days,memberId:member.id};
}

export async function loadCalendar(requested?: string) {
  const { client, member } = await requireMember();
  const now = new Date().toISOString(); const h = horizon(now);
  const week = requested ?? h.current;
  if (monday(week) !== week || week < h.first || week > h.last) throw new Error("Cette semaine n’est pas disponible.");
  const dates = weekDays(week);
  const [members, profiles, days, group] = await Promise.all([
    client.from("memberships").select("id,user_id").eq("status", "active").order("joined_at"),
    client.from("profiles").select("user_id,display_name"),
    client.from("availability_days").select("*, availability_intervals(starts_at,ends_at)").gte("local_date", week).lte("local_date", addDays(week, 7)),
    client.from("groups").select("quick_start,quick_end").single(),
  ]);
  if (members.error || profiles.error || days.error || group.error) throw new Error("Le calendrier est temporairement indisponible.");
  const calendar = members.data.map((m) => ({ id: m.id, name: profiles.data.find((p) => p.user_id === m.user_id)?.display_name ?? "Membre", days: dates.map((d) => {
    const row = days.data.find((r) => r.membership_id === m.id && r.local_date === d);
    return row ? { local_date: d, status: row.status as Day["status"], mode: row.mode as Day["mode"], revision: row.revision, intervals: normalize(row.availability_intervals) } : emptyDay(d);
  }) }));
  const extra = days.data.find((d) => d.membership_id === member.id && d.local_date === addDays(week, 7));
  return { now, week, horizon: h, memberId: member.id, calendar, own: calendar.find((m) => m.id === member.id)!.days,
    next: extra ? { local_date: extra.local_date, status: extra.status as Day["status"], mode: extra.mode as Day["mode"], revision: extra.revision, intervals: normalize(extra.availability_intervals) } : emptyDay(addDays(week, 7)),
    quick: { start: group.data.quick_start.slice(0, 5), end: group.data.quick_end.slice(0, 5) } };
}
