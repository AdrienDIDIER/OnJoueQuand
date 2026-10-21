import { describe, expect, it } from "vitest";
import { addDays, intervalLabel, localInstant, localParts, monday } from "../../lib/time/paris";
import { complete, copyPlan, emptyDay, normalize, savePlan, weekDays, type Day } from "./domain";
const now = "2026-10-20T12:00:00Z";
const days = (week: string) => weekDays(week).map(emptyDay);
const available = (day: string, start = "20:00", end = "23:00"): Day => ({ local_date: day, status: "available", mode: "detailed", revision: 1, intervals: [{ starts_at: localInstant(day, start), ends_at: localInstant(day, end) }] });

describe("Temps de Paris", () => {
  it("refuse une heure inexistante même avec une occurrence", () => {
    expect(() => localInstant("2026-03-29", "02:30", "later")).toThrow("n’existe pas");
  });
  it("exige puis distingue les deux occurrences d'automne", () => {
    expect(() => localInstant("2026-10-25", "02:30")).toThrow("deux fois");
    expect(localInstant("2026-10-25", "02:30", "earlier")).toBe("2026-10-25T00:30:00Z");
    expect(localInstant("2026-10-25", "02:30", "later")).toBe("2026-10-25T01:30:00Z");
    expect(localParts("2026-10-25T01:30:00Z").occurrence).toBe("later");
    expect(intervalLabel("2026-10-25T01:15:00Z", "2026-10-25T01:45:00Z", "2026-10-25")).toBe("02:15–02:45 (UTC+01:00)");
  });
  it("identifie le lundi à cheval sur deux années et valide le pas", () => {
    expect(monday("2027-01-01")).toBe("2026-12-28");
    expect(() => localInstant("2026-10-20", "20:07")).toThrow("quinze minutes");
  });
});
describe("Disponibilités", () => {
  it("matérialise le rapide et distingue la non-réponse", () => {
    const d = emptyDay("2026-10-20");
    const plan = savePlan(d, emptyDay("2026-10-21"), "available", "quick", [], now);
    expect(plan[0]?.intervals).toEqual([{ starts_at: "2026-10-20T18:00:00Z", ends_at: "2026-10-20T21:00:00Z" }]);
    expect(complete([d, { ...d, status: "unavailable" }])).toBe(1);
  });
  it("fusionne chevauchements et contiguïtés sans muter les entrées", () => {
    const a = available("2026-10-20", "20:00", "21:00").intervals[0]!;
    const b = available("2026-10-20", "21:00", "22:00").intervals[0]!;
    expect(normalize([b, a])).toEqual([{ starts_at: a.starts_at, ends_at: b.ends_at }]);
    expect(localParts(a.ends_at).time).toBe("21:00");
  });
  it("découpe minuit et conserve les intervalles suivants avec leur révision", () => {
    const next = available("2026-10-21", "20:00", "21:00");
    const plan = savePlan(emptyDay("2026-10-20"), next, "available", "detailed", [{ start: "23:00", end: "01:00", overnight: true }], now);
    expect(plan).toHaveLength(2); expect(plan[1]?.expected_revision).toBe(1);
    expect(plan[1]?.intervals).toHaveLength(2);
    expect(plan[0]?.intervals[0]?.ends_at).toBe(plan[1]?.intervals[0]?.starts_at);
  });
  it("rejette une traversée hors horizon, et une journée sans intervalle", () => {
    expect(() => savePlan(emptyDay("2026-11-15"), emptyDay("2026-11-16"), "available", "detailed", [{ start: "23:00", end: "01:00", overnight: true }], now)).toThrow("modifiables");
    expect(() => savePlan(emptyDay("2026-10-20"), emptyDay("2026-10-21"), "available", "detailed", [], now)).toThrow("intervalles");
  });
  it("vide les intervalles pour indisponible et sans réponse", () => {
    for (const status of ["unanswered", "unavailable"] as const) expect(savePlan(available("2026-10-20"), emptyDay("2026-10-21"), status, "quick", [], now)[0]?.intervals).toEqual([]);
  });
});
describe("Copie", () => {
  it("garde l'heure locale à travers la transition d'automne", () => {
    const source = days("2026-10-19"); source[0] = available("2026-10-19");
    const plan = copyPlan(source, days("2026-10-26"), false, now);
    expect(plan.changes[0]?.intervals[0]?.starts_at).toBe("2026-10-26T19:00:00Z");
    expect(plan.guards).toHaveLength(7);
  });
  it("préserve les réponses existantes et ne copie pas les non-réponses", () => {
    const source = days("2026-10-19"); source[0] = available("2026-10-19"); source[1] = available("2026-10-20");
    const target = days("2026-10-26"); target[0] = { ...emptyDay("2026-10-26"), status: "unavailable", revision: 2 };
    expect(copyPlan(source, target, false, now).changes.map((d) => d.local_date)).toEqual(["2026-10-27"]);
    expect(copyPlan(source, target, true, now).changes).toHaveLength(2);
  });
  it("signale les anomalies DST de copie avant toute écriture", () => {
    const source = days("2026-10-12"); source[6] = available("2026-10-18", "02:15", "02:45");
    expect(() => copyPlan(source, days("2026-10-19"), false, now)).toThrow("deux fois");
    expect(copyPlan(source, days("2026-10-19"), false, now, { "6-0-start": "earlier", "6-0-end": "later" }).changes).toHaveLength(1);
    const spring = days("2026-03-16"); spring[6] = available("2026-03-22", "02:15", "03:00");
    expect(() => copyPlan(spring, days("2026-03-23"), false, "2026-03-23T10:00:00Z")).toThrow("n’existe pas");
    const corrected = copyPlan(spring, days("2026-03-23"), false, "2026-03-23T10:00:00Z", {}, { "6-0-start": "01:45" });
    expect(localParts(corrected.changes[0]!.intervals[0]!.starts_at).time).toBe("01:45");
  });
  it("copie les fins à minuit au bon jour et refuse les sources trop anciennes", () => {
    const source = days("2026-10-19"); source[0] = available("2026-10-19", "23:00", "24:00");
    expect(localParts(copyPlan(source, days("2026-10-26"), false, now).changes[0]!.intervals[0]!.ends_at).date).toBe("2026-10-27");
    expect(() => copyPlan(days(addDays("2026-10-19", -91)), days("2026-10-19"), false, now)).toThrow("conservée");
  });
});
