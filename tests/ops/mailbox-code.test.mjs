import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractMailboxCode } from "../../scripts/local-supabase.mjs";

test("recette OTP : ignorer les couleurs numériques et lire le code visible", () => {
  const code = "482916"; // Exemple synthétique, jamais une demande Auth réelle.
  const HTML = readFileSync(new URL("../../supabase/templates/code.html", import.meta.url), "utf8").replace("{{ .Token }}", code);
  assert.equal(extractMailboxCode({ HTML }), code);
  assert.equal(extractMailboxCode({ HTML, Text: `Votre code : ${code}` }), code);
  assert.equal(extractMailboxCode({ HTML: '<style>.card{color:#123456}</style><p style="color:#654321">Aucun code</p>' }), undefined);
  assert.equal(extractMailboxCode({}), undefined);
});
