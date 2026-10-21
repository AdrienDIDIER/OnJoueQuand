"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/features/auth/server";
import { addDays, dayLabel, intervalLabel, localInstant, localParts, monday } from "@/lib/time/paris";
import { copyPlan, savePlan, type Change, type Guard } from "./domain";
import { loadCalendar } from "./server";
import { readPreview, signPreview } from "./preview";

export type AvailabilityState = { message: string; token?: string; summary?: string[]; done?: boolean; resolutions?: { key: string; label: string; kind: "occurrence" | "time" }[] };
const occurrence = z.enum(["earlier", "later"]).optional();
const rangesSchema = z.array(z.object({ start: z.string(), end: z.string(), overnight: z.boolean().optional(), startOccurrence: occurrence, endOccurrence: occurrence })).max(16);
function failure(error: unknown): AvailabilityState { return { message: error instanceof Error && error.constructor === Error ? error.message : "Saisie invalide. Vérifiez les dates et horaires." }; }
function preview(actor: string, changes: Change[], guards: Guard[]): AvailabilityState {
  return { message: "Vérifiez les journées ci-dessous avant de confirmer. Les modifications sont appliquées ensemble.", token: signPreview({ actor, expires: Date.now() + 600_000, changes, guards }),
    summary: changes.map((d) => `${dayLabel(d.local_date)} : ${d.status === "unanswered" ? "Sans réponse" : d.status === "unavailable" ? "Indisponible" : `Disponible · ${d.intervals.map((i) => intervalLabel(i.starts_at, i.ends_at, d.local_date)).join(", ")}`}${d.expected_revision !== null ? " (remplace la réponse enregistrée)" : ""}`) };
}

export async function previewDay(_state: AvailabilityState, form: FormData): Promise<AvailabilityState> {
  const { user } = await requireMember();
  try {
    const localDate = z.string().parse(form.get("date"));
    const state = await loadCalendar(monday(localDate));
    const d = state.own.find((x) => x.local_date === localDate)!;
    const next = state.own.find((x) => x.local_date === addDays(localDate, 1)) ?? state.next;
    const revisions = z.array(z.object({ local_date: z.string(), revision: z.number().nullable() })).parse(JSON.parse(String(form.get("revisions"))));
    const status = z.enum(["unanswered", "unavailable", "available"]).parse(form.get("status"));
    const mode = z.enum(["quick", "detailed"]).parse(form.get("mode"));
    const ranges = rangesSchema.parse(JSON.parse(String(form.get("ranges"))));
    const changes = savePlan(d, next, status, mode, ranges, state.now, state.quick);
    for (const row of changes) if (revisions.find((r) => r.local_date === row.local_date)?.revision !== row.expected_revision) throw new Error("Disponibilités modifiées. Rechargez la page avant de continuer.");
    return preview(user.id, changes, []);
  } catch (error) { return failure(error); }
}

export async function previewCopy(_state: AvailabilityState, form: FormData): Promise<AvailabilityState> {
  const { user } = await requireMember();
  try {
    const sourceWeek = z.string().parse(form.get("source")); const targetWeek = z.string().parse(form.get("target"));
    if (sourceWeek === targetWeek) throw new Error("Choisissez une semaine source différente.");
    const [source, target] = await Promise.all([loadCalendar(sourceWeek), loadCalendar(targetWeek)]);
    const occurrences = z.record(z.string(), occurrence).parse(JSON.parse(String(form.get("occurrences") ?? "{}")));
    const corrections = z.record(z.string(), z.string()).parse(JSON.parse(String(form.get("corrections") ?? "{}")));
    const resolutions: NonNullable<AvailabilityState["resolutions"]> = [];
    source.own.forEach((day, i) => day.intervals.forEach((range, j) => {
      if (form.get("replace") !== "on" && target.own[i]!.status !== "unanswered") return;
      for (const edge of ["start", "end"] as const) {
        const local = localParts(edge === "start" ? range.starts_at : range.ends_at);
        const targetDate = local.date > day.local_date ? addDays(target.own[i]!.local_date, 1) : target.own[i]!.local_date;
        const key = `${i}-${j}-${edge}`;
        try { localInstant(targetDate, local.time); }
        catch (error) {
          if (error instanceof Error && (error.message.includes("deux fois") || error.message.includes("n’existe pas"))) resolutions.push({ key, kind: error.message.includes("deux fois") ? "occurrence" : "time", label: `${dayLabel(targetDate)} à ${local.time} · ${edge === "start" ? "début" : "fin"} de l’intervalle ${j + 1}` });
          else throw error;
        }
      }
    }));
    try {
      const plan = copyPlan(source.own, target.own, form.get("replace") === "on", target.now, occurrences, corrections);
      return { ...preview(user.id, plan.changes, plan.guards), resolutions };
    } catch (error) { return { ...failure(error), resolutions }; }
  } catch (error) { return failure(error); }
}

export async function applyAvailability(_state: AvailabilityState, form: FormData): Promise<AvailabilityState> {
  const { client, user } = await requireMember();
  try {
    const token = z.string().parse(form.get("token"));
    const plan = readPreview(token, user.id, Date.now());
    const { error } = await client.rpc("save_availability", { changes: plan.changes, sources: plan.guards });
    if (error) return { message: "Enregistrement refusé : les disponibilités ont changé ou la période n’est plus modifiable. Rechargez puis refaites l’aperçu." };
    revalidatePath("/dispos"); revalidatePath("/accueil");
    return { message: "Disponibilités enregistrées.", done: true };
  } catch (error) { return failure(error); }
}
