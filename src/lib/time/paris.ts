import { Temporal } from "@js-temporal/polyfill";

export const TIMEZONE = "Europe/Paris";
export type Occurrence = "earlier" | "later" | undefined;
export function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date invalide.");
  try { return Temporal.PlainDate.from(value); }
  catch { throw new Error("Date invalide."); }
}
export function addDays(value: string, days: number) { return date(value).add({ days }).toString(); }
export function monday(value: string) { const d = date(value); return d.subtract({ days: d.dayOfWeek - 1 }).toString(); }
export function today(now: string) { return Temporal.Instant.from(now).toZonedDateTimeISO(TIMEZONE).toPlainDate().toString(); }
export function compareInstant(a: string, b: string) { return Temporal.Instant.compare(a, b); }
export function instantMillis(value: string) { return Temporal.Instant.from(value).epochMilliseconds; }
export function instantISO(milliseconds: number) { return Temporal.Instant.fromEpochMilliseconds(milliseconds).toString(); }
export function quarterStarts(start: string, end: string): number[] {
  const first = Temporal.Instant.from(start); const z = first.toZonedDateTimeISO(TIMEZONE);
  // Paris : les transitions modernes sont des multiples de quinze minutes.
  // Avancer sur la ligne des instants énumère les deux occurrences d'automne et saute les heures inexistantes.
  const lower = first.epochMilliseconds; const upper = instantMillis(end);
  let cursor = lower - z.second * 1000 - z.millisecond + ((15 - z.minute % 15) % 15) * 60_000;
  if (Temporal.Instant.compare(Temporal.Instant.fromEpochMilliseconds(cursor), first) < 0) cursor += 15 * 60_000;
  const result: number[] = [];
  for (; cursor < upper; cursor += 15 * 60_000) result.push(cursor);
  return result;
}
export function localInstant(day: string, time: string, occurrence?: Occurrence): string {
  if (time === "24:00") return localInstant(addDays(day, 1), "00:00", occurrence);
  if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(time)) throw new Error("Choisissez un horaire par pas de quinze minutes.");
  const local = date(day).toPlainDateTime(time);
  const early = local.toZonedDateTime(TIMEZONE, { disambiguation: "earlier" });
  const late = local.toZonedDateTime(TIMEZONE, { disambiguation: "later" });
  if (!early.toPlainDateTime().equals(local) || !late.toPlainDateTime().equals(local)) throw new Error(`Le ${day} à ${time}, cette heure n’existe pas à Paris. Choisissez un autre horaire.`);
  if (!early.equals(late) && !occurrence) throw new Error(`Le ${day} à ${time}, cette heure existe deux fois. Choisissez la première ou la seconde occurrence.`);
  return (occurrence === "later" ? late : early).toInstant().toString();
}
export function localParts(instant: string) {
  const z = Temporal.Instant.from(instant).toZonedDateTimeISO(TIMEZONE);
  const local = z.toPlainDateTime();
  const early = local.toZonedDateTime(TIMEZONE, { disambiguation: "earlier" });
  const late = local.toZonedDateTime(TIMEZONE, { disambiguation: "later" });
  const occurrence: Occurrence = early.equals(late) ? undefined : z.equals(early) ? "earlier" : "later";
  return { date: z.toPlainDate().toString(), time: z.toPlainTime().toString({ smallestUnit: "minute" }), offset: z.offset, occurrence };
}
export function dayLabel(value: string) { return date(value).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
export function intervalLabel(start: string, end: string, day: string) {
  const a = localParts(start); const b = localParts(end);
  const offset = a.offset !== b.offset ? ` (UTC${a.offset} → UTC${b.offset})` : a.occurrence || b.occurrence ? ` (UTC${a.offset})` : "";
  return `${a.time}–${b.date > day ? "24:00" : b.time}${offset}`;
}
