import { addDays, compareInstant, localInstant, localParts, monday, today, type Occurrence } from "../../lib/time/paris";

export type Interval = { starts_at: string; ends_at: string };
export type Day = { local_date: string; status: "unanswered" | "unavailable" | "available"; mode: "quick" | "detailed" | null; revision: number | null; intervals: Interval[] };
export type Change = Omit<Day, "revision"> & { expected_revision: number | null };
export type Guard = { local_date: string; expected_revision: number | null };
export type LocalRange = { start: string; end: string; overnight?: boolean; startOccurrence?: Occurrence; endOccurrence?: Occurrence };
export function emptyDay(local_date: string): Day { return { local_date, status: "unanswered", mode: null, revision: null, intervals: [] }; }
export function weekDays(week: string) { if (monday(week) !== week) throw new Error("Choisissez un lundi."); return Array.from({ length: 7 }, (_, i) => addDays(week, i)); }
export function horizon(now: string) { const current = monday(today(now)); return { first: addDays(current, -84), current, last: addDays(current, 27) }; }
export function assertEditable(day: string, now: string) { const h = horizon(now); if (day < h.current || day > h.last) throw new Error("Seules la semaine courante et les trois suivantes sont modifiables."); }
export function complete(days: Day[]) { return days.filter((d) => d.status !== "unanswered").length; }
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => compareInstant(a.starts_at, b.starts_at));
  const result: Interval[] = [];
  for (const item of sorted) {
    if (compareInstant(item.starts_at, item.ends_at) >= 0) throw new Error("La fin doit être après le début.");
    const previous = result.at(-1);
    if (previous && compareInstant(item.starts_at, previous.ends_at) <= 0) {
      if (compareInstant(item.ends_at, previous.ends_at) > 0) previous.ends_at = item.ends_at;
    } else result.push({ ...item });
  }
  return result;
}
export function savePlan(day: Day, next: Day, status: Day["status"], mode: Day["mode"], ranges: LocalRange[], now: string, quick = { start: "20:00", end: "23:00" }): Change[] {
  assertEditable(day.local_date, now);
  if (status !== "available") return [{ local_date: day.local_date, status, mode: null, intervals: [], expected_revision: day.revision }];
  if (mode !== "quick" && mode !== "detailed") throw new Error("Choisissez un mode de saisie.");
  const input = mode === "quick" ? [{ start: quick.start, end: quick.end }] : ranges;
  if (!input.length || input.length > 16) throw new Error("Renseignez de un à seize intervalles.");
  const midnight = localInstant(addDays(day.local_date, 1), "00:00");
  const current: Interval[] = []; const following: Interval[] = [];
  for (const r of input) {
    const start = localInstant(day.local_date, r.start, r.startOccurrence);
    const end = localInstant(r.overnight ? addDays(day.local_date, 1) : day.local_date, r.end, r.endOccurrence);
    if (compareInstant(start, midnight) >= 0 || compareInstant(end, start) <= 0) throw new Error("Vérifiez les horaires et cochez « lendemain » pour traverser minuit.");
    current.push({ starts_at: start, ends_at: compareInstant(end, midnight) > 0 ? midnight : end });
    if (compareInstant(end, midnight) > 0) following.push({ starts_at: midnight, ends_at: end });
  }
  const result: Change[] = [{ local_date: day.local_date, status, mode, intervals: normalize(current), expected_revision: day.revision }];
  if (following.length) {
    assertEditable(next.local_date, now);
    if (next.local_date !== addDays(day.local_date, 1)) throw new Error("Journée suivante invalide.");
    result.push({ local_date: next.local_date, status: "available", mode: "detailed", expected_revision: next.revision, intervals: normalize([...next.intervals, ...following]) });
  }
  return result;
}
export function copyPlan(source: Day[], target: Day[], replace: boolean, now: string, occurrences: Record<string, Occurrence> = {}, corrections: Record<string, string> = {}): { changes: Change[]; guards: Guard[] } {
  if (source.length !== 7 || target.length !== 7 || monday(source[0]!.local_date) !== source[0]!.local_date || monday(target[0]!.local_date) !== target[0]!.local_date) throw new Error("Choisissez deux semaines complètes.");
  const h = horizon(now); const changes: Change[] = [];
  const guards = source.map((s) => ({ local_date: s.local_date, expected_revision: s.revision }));
  source.forEach((s, i) => {
    const t = target[i]!;
    if (s.local_date !== addDays(source[0]!.local_date, i) || t.local_date !== addDays(target[0]!.local_date, i)) throw new Error("Semaine invalide.");
    if (s.local_date < h.first || s.local_date > h.last) throw new Error("La semaine source est hors de la période conservée.");
    assertEditable(t.local_date, now);
    if (s.status === "unanswered" || (!replace && t.status !== "unanswered")) return;
    const intervals = s.intervals.map((r, j) => {
      const a = localParts(r.starts_at); const b = localParts(r.ends_at);
      return { starts_at: localInstant(t.local_date, corrections[`${i}-${j}-start`] ?? a.time, occurrences[`${i}-${j}-start`]), ends_at: localInstant(b.date > s.local_date ? addDays(t.local_date, 1) : t.local_date, corrections[`${i}-${j}-end`] ?? b.time, occurrences[`${i}-${j}-end`]) };
    });
    changes.push({ local_date: t.local_date, status: s.status, mode: s.mode, intervals: normalize(intervals), expected_revision: t.revision });
  });
  if (!changes.length) throw new Error("Aucune journée à copier : la source est sans réponse ou les journées cibles sont déjà renseignées.");
  return { changes, guards };
}
