import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackup, validateDatabaseEnvironment } from "../../scripts/ops/backup.mjs";

const age = process.env.AGE_BIN || "age";
const keygen = process.env.AGE_KEYGEN_BIN || "age-keygen";

test("export chiffré : aller-retour réel age, clé incorrecte et archive altérée refusées", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ojq-backup-test-"));
  try {
    const key = join(directory, "identity");
    execFileSync(keygen, ["-o", key], { stdio: "ignore" });
    const recipient = execFileSync(keygen, ["-y", key], { encoding: "utf8" }).trim();
    const output = join(directory, "backup.age");
    const plaintext = "PGDMP : identités et données synthétiques uniquement";
    await createBackup({ output, recipient, age, command: [process.execPath, "-e", `process.stdout.write(${JSON.stringify(plaintext)})`] });
    assert.equal(execFileSync(age, ["--decrypt", "-i", key, "-o", "-", output], { encoding: "utf8" }), plaintext);
    assert.equal((await readFile(output)).includes(Buffer.from(plaintext)), false);
    await assert.rejects(createBackup({ output, recipient, age }), /existe déjà/);
    const other = join(directory, "other");
    execFileSync(keygen, ["-o", other], { stdio: "ignore" });
    assert.throws(() => execFileSync(age, ["-d", "-i", other, "-o", "-", output], { stdio: "ignore" }));
    const bytes = await readFile(output); bytes[bytes.length - 1] ^= 1;
    await writeFile(output, bytes);
    assert.throws(() => execFileSync(age, ["-d", "-i", key, "-o", "-", output], { stdio: "ignore" }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("un export interrompu ne publie aucune sauvegarde ni fichier partiel", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ojq-backup-failure-"));
  try {
    const key = join(directory, "identity");
    execFileSync(keygen, ["-o", key], { stdio: "ignore" });
    const recipient = execFileSync(keygen, ["-y", key], { encoding: "utf8" }).trim();
    const output = join(directory, "backup.age");
    await assert.rejects(createBackup({ output, recipient, age, command: [process.execPath, "-e", "process.stdout.write('incomplet');process.exit(1)"] }), /non publiée/);
    await assert.rejects(access(output)); await assert.rejects(access(`${output}.partial`));
    await assert.rejects(createBackup({ output, recipient, age: join(directory, "absent"), command: [process.execPath, "-e", "process.stdout.write('incomplet')"] }), /non publiée/);
    await assert.rejects(access(`${output}.partial`));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("TLS et configuration : refus des connexions distantes non vérifiées", () => {
  const env = { PGHOST: "db.example.test", PGPORT: "5432", PGDATABASE: "postgres", PGUSER: "backup", PGPASSWORD: "synthétique" };
  assert.throws(() => validateDatabaseEnvironment(env), /verify-full/);
  assert.throws(() => validateDatabaseEnvironment({ ...env, PGSSLMODE: "require" }), /verify-full/);
  assert.doesNotThrow(() => validateDatabaseEnvironment({ ...env, PGSSLMODE: "verify-full" }));
  assert.doesNotThrow(() => validateDatabaseEnvironment({ ...env, PGHOST: "127.0.0.1" }));
  assert.throws(() => validateDatabaseEnvironment({}), /incomplète/);
});
