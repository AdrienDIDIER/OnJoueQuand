import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPreproduction, bootstrapIdentity, privilegedKey, PROJECT_REF } from "../../scripts/bootstrap-preprod.mjs";

test("bootstrap préproduction : refuser une autre cible et toute clé publique ou masquée", () => {
  assert.doesNotThrow(() => assertPreproduction(`${PROJECT_REF}\n`));
  assert.throws(() => assertPreproduction("un-autre-projet"));
  for (const data of [[], { keys: [{ type: "publishable", api_key: "sb_publishable_exemple" }] }, { keys: [{ type: "secret", api_key: "sb_secret_••••" }] }]) assert.throws(() => privilegedKey(data));
  assert.equal(privilegedKey([{ type: "secret", api_key: "sb_secret_synthetique" }]), "sb_secret_synthetique");
  assert.equal(privilegedKey({ api_keys: [{ name: "service_role", api_key: "synthetique.exemple.signature" }] }), "synthetique.exemple.signature");
});
test("bootstrap préproduction : valider la saisie locale sans attribuer un rôle depuis des métadonnées", () => {
  assert.deepEqual(bootstrapIdentity(" ADMIN@example.test ", " Joueur "), { email: "admin@example.test", name: "Joueur" });
  for (const [email, name] of [["invalide", "Joueur"], ["admin@example.test", " "], ["admin@example.test", "x".repeat(61)]]) assert.throws(() => bootstrapIdentity(email, name));
});
