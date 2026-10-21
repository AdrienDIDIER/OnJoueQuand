import "server-only";
import { requireMember } from "@/features/auth/server";
import { emptyDay, horizon, normalize, weekDays, type Day } from "./domain";
import { addDays, monday } from "@/lib/time/paris";

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
