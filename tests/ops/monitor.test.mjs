import { test } from "node:test";
import assert from "node:assert/strict";
import { assessHealth } from "../../scripts/ops/monitor.mjs";

test("surveillance : ordonnanceur arrêté, heartbeat absent et file bloquée déclenchent une alerte", () => {
  const healthy = { cron_active: true, worker_age_seconds: 300, outbox_age_seconds: 0, outbox_failed: 0, push_failed: 0 };
  assert.deepEqual(assessHealth(healthy), []);
  assert.equal(assessHealth({ ...healthy, cron_active: false }).length, 1);
  for (const age of [null, undefined, -1, 901]) assert.equal(assessHealth({ ...healthy, worker_age_seconds: age }).length, 1);
  assert.equal(assessHealth({ ...healthy, worker_age_seconds: 900, outbox_age_seconds: 900 }).length, 0);
  assert.equal(assessHealth({ ...healthy, outbox_age_seconds: 901, outbox_failed: 1, push_failed: 1 }).length, 3);
});
