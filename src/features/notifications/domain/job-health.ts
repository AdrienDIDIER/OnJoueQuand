import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
export const jobHealthSchema = z.object({
  checked_at: timestamp,
  cron_active: z.boolean(),
  last_run: z.object({ started_at: timestamp, finished_at: timestamp.nullable(), status: z.enum(["running", "completed", "failed", "abandoned"]) }).nullable(),
  last_success_at: timestamp.nullable(),
  worker_age_seconds: z.number().nullable(),
  outbox_age_seconds: z.number().nonnegative(),
  outbox_pending: z.number().int().nonnegative(),
  outbox_failed: z.number().int().nonnegative(),
  deliveries_pending: z.number().int().nonnegative(),
  deliveries_failed: z.number().int().nonnegative(),
});
export type JobHealth = z.infer<typeof jobHealthSchema>;

// Les durées viennent du snapshot PostgreSQL ; aucune horloge du navigateur.
export function jobHealthAlerts(status: JobHealth): string[] {
  const alerts: string[] = [];
  if (!status.cron_active) alerts.push("Les rappels automatiques sont désactivés.");
  if (status.worker_age_seconds === null) alerts.push("Aucun traitement réussi enregistré.");
  else if (status.worker_age_seconds < 0 || status.worker_age_seconds > 900) alerts.push("Aucun traitement réussi dans les quinze dernières minutes.");
  if (status.outbox_age_seconds > 900) alerts.push("Des événements attendent depuis plus de quinze minutes.");
  if (status.outbox_failed > 0) alerts.push("Des événements sont en échec.");
  if (status.deliveries_failed > 0) alerts.push("Des envois Push sont en échec.");
  return alerts;
}
