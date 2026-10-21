import { test } from "node:test";
import assert from "node:assert/strict";
import { backupIsRecent } from "../../scripts/ops/backup-age.mjs";

test("âge réel : échec, absence, expiration, mauvaise archive et dépassement de 24 h déclenchent l’alerte", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const run = { id: 42, conclusion: "success", run_started_at: "2026-10-21T03:17:00Z", updated_at: "2026-10-21T03:20:00Z" };
  const artifact = { name: "sauvegarde-42", expired: false, size_in_bytes: 1024, created_at: "2026-10-21T03:19:00Z", expires_at: "2026-10-28T03:20:00Z" };
  assert.equal(backupIsRecent(run, [artifact], now), true);
  assert.equal(backupIsRecent(undefined, [], now), false);
  assert.equal(backupIsRecent({ ...run, conclusion: "failure" }, [artifact], now), false);
  assert.equal(backupIsRecent(run, [], now), false);
  for (const invalid of [{ expired: true }, { expires_at: "2026-10-21T11:00:00Z" }, { name: "autre" }, { size_in_bytes: 0 }]) assert.equal(backupIsRecent(run, [{ ...artifact, ...invalid }], now), false);
  for (const date of ["2026-10-20T12:00:00Z", "2026-10-22T03:20:00Z", "invalide"]) assert.equal(backupIsRecent({ ...run, updated_at: date }, [artifact], now), false);
});
