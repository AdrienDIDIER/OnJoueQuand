import { describe, expect, it } from "vitest";
import { jobHealthAlerts, jobHealthSchema, type JobHealth } from "./job-health";

const healthy: JobHealth = { checked_at: "2026-10-21T12:00:00Z", cron_active: true, last_run: null, last_success_at: "2026-10-21T11:55:00Z", worker_age_seconds: 300, outbox_age_seconds: 0, outbox_pending: 0, outbox_failed: 0, deliveries_pending: 0, deliveries_failed: 0 };
describe("état du traitement pour l’administration", () => {
  it("distingue un cron inactif d’un traitement réussi et ne considère jamais l’absence comme saine", () => {
    expect(jobHealthAlerts(healthy)).toEqual([]);
    expect(jobHealthAlerts({ ...healthy, cron_active: false, worker_age_seconds: null })).toHaveLength(2);
    expect(jobHealthAlerts({ ...healthy, worker_age_seconds: 901, outbox_age_seconds: 901, outbox_failed: 1, deliveries_failed: 1 })).toHaveLength(4);
    expect(jobHealthAlerts({ ...healthy, worker_age_seconds: 900 })).toEqual([]);
  });
  it("refuse une réponse incomplète plutôt que d’afficher un état sain", () => {
    expect(jobHealthSchema.safeParse(healthy).success).toBe(true);
    expect(jobHealthSchema.safeParse({}).success).toBe(false);
    expect(jobHealthSchema.safeParse({ ...healthy, outbox_failed: -1 }).success).toBe(false);
  });
});
