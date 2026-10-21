import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateDatabaseEnvironment } from "./backup.mjs";

export const monitoringSql = `select json_build_object(
  'cron_active',coalesce((select bool_or(active) from cron.job where jobname='ojq-notifications'),false),
  'worker_age_seconds',extract(epoch from (clock_timestamp()-(select max(finished_at) from private.job_runs where status='completed'))),
  'outbox_age_seconds',coalesce((select max(extract(epoch from (clock_timestamp()-available_at))) from private.notification_outbox where status in ('pending','processing') and available_at<=clock_timestamp()),0),
  'outbox_failed',(select count(*) from private.notification_outbox where status='failed'),
  'push_failed',(select count(*) from private.notification_deliveries where status='failed')
);`;

export function assessHealth(metrics) {
  const alerts = [];
  if (metrics.cron_active !== true) alerts.push("Ordonnanceur désactivé.");
  if (metrics.worker_age_seconds === null || !Number.isFinite(metrics.worker_age_seconds) || metrics.worker_age_seconds < 0 || metrics.worker_age_seconds > 900) alerts.push("Aucun traitement réussi dans les quinze dernières minutes.");
  if (!Number.isFinite(metrics.outbox_age_seconds) || metrics.outbox_age_seconds > 900) alerts.push("Événements en attente depuis plus de quinze minutes.");
  if (metrics.outbox_failed > 0) alerts.push("Événements en échec à examiner.");
  if (metrics.push_failed > 0) alerts.push("Livraisons Push en échec à examiner.");
  return alerts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    validateDatabaseEnvironment(process.env);
    const raw = execFileSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", monitoringSql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
    const alerts = assessHealth(JSON.parse(raw));
    for (const alert of alerts) console.error(alert);
    if (alerts.length) process.exitCode = 1;
    else console.log("Ordonnanceur et traitement opérationnels.");
  } catch { console.error("Contrôle d’exploitation indisponible."); process.exitCode = 2; }
}
