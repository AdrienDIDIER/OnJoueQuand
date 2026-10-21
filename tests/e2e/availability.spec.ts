import { expect, test } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { clients, checked } from "../../scripts/local-supabase.mjs";
import { addDays, dayLabel, monday, today } from "../../src/lib/time/paris";

test("saisir, traverser minuit, copier et protéger une confirmation périmée", async ({ page }, testInfo) => {
  const { admin, config } = clients();
  const email = `dispos-ui-${randomUUID()}@example.test`;
  const account = checked(await admin.auth.admin.createUser({ email, email_confirm: true })).user;
  const group = checked(await admin.from("groups").select("id").single());
  checked(await admin.from("profiles").insert({ user_id: account.id, display_name: "Recette Dispos" }));
  const member = checked(await admin.from("memberships").insert({ group_id: group.id, user_id: account.id }).select("id").single());
  try {
    const link = checked(await admin.auth.admin.generateLink({ type: "magiclink", email }));
    const cookies = new Map<string, string>();
    const client = createServerClient(config.url, config.key, { cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    } });
    checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" }));
    await page.context().addCookies([...cookies].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/" })));
    const week = monday(today(new Date().toISOString()));
    const editor = (n: number) => page.locator(".day-editor").filter({ hasText: dayLabel(addDays(week, n)) });
    await page.goto(`/dispos?semaine=${week}`);
    await expect(page.getByRole("heading", { name: "Mes réponses · 0/7" })).toBeVisible();
    await editor(0).locator("summary").click();
    await editor(0).getByLabel("Votre réponse").selectOption("available");
    await editor(0).getByRole("button", { name: "Prévisualiser cette journée" }).click();
    await expect(editor(0).getByText("Disponible · 20:00–23:00", { exact: false })).toBeVisible();
    await editor(0).getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(page.getByRole("heading", { name: "Mes réponses · 1/7" })).toBeVisible();

    await editor(1).locator("summary").click();
    await editor(1).getByLabel("Votre réponse").selectOption("available");
    await editor(1).getByLabel("Mode de saisie").selectOption("detailed");
    await editor(1).getByLabel("Début 1", { exact: true }).fill("23:00");
    await editor(1).getByLabel("Fin 1", { exact: true }).fill("01:00");
    await editor(1).getByLabel("Fin le lendemain").check();
    await editor(1).getByRole("button", { name: "Prévisualiser cette journée" }).click();
    await expect(editor(1).getByRole("listitem")).toHaveCount(2);
    await editor(1).getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(page.getByRole("heading", { name: "Mes réponses · 3/7" })).toBeVisible();

    await editor(3).locator("summary").click();
    await editor(3).getByLabel("Votre réponse").selectOption("unavailable");
    await editor(3).getByRole("button", { name: "Prévisualiser cette journée" }).click();
    await editor(3).getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(page.getByRole("heading", { name: "Mes réponses · 4/7" })).toBeVisible();
    await page.getByRole("heading", { name: "Vos disponibilités.", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("disponibilites.png"), fullPage: true });

    const target = addDays(week, 7);
    await page.goto(`/dispos?semaine=${target}`);
    const first = page.locator(".day-editor").first();
    await first.locator("summary").click();
    await first.getByLabel("Votre réponse").selectOption("unavailable");
    await first.getByRole("button", { name: "Prévisualiser cette journée" }).click();
    await first.getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(page.getByRole("heading", { name: "Mes réponses · 1/7" })).toBeVisible();
    await page.getByText("Reprendre une semaine précédente",{exact:true}).click();
    const copy = page.getByRole("heading", { name: "Copier une semaine" }).locator("..");
    await copy.getByRole("button", { name: "Prévisualiser la copie" }).click();
    await expect(copy.getByRole("listitem")).toHaveCount(3);
    await copy.getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(page.getByRole("heading", { name: "Mes réponses · 4/7" })).toBeVisible();
    await expect(first.locator(".day-heading")).toContainText("Indisponible");

    await copy.getByLabel("Remplacer aussi mes journées déjà renseignées").check();
    await copy.getByRole("button", { name: "Prévisualiser la copie" }).click();
    await expect(copy.getByRole("listitem")).toHaveCount(4);
    // Édition dans une autre requête après l'aperçu : aucun écrasement silencieux.
    const source = checked(await client.from("availability_days").select("revision").eq("membership_id", member.id).eq("local_date", week).single());
    checked(await client.rpc("save_availability", { changes: [{ local_date: week, status: "unavailable", mode: null, expected_revision: source.revision, intervals: [] }] }));
    await copy.getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(copy.getByText("Enregistrement refusé", { exact: false })).toBeVisible();
    await page.reload();
    await page.getByText("Reprendre une semaine précédente",{exact:true}).click();
    await copy.getByLabel("Remplacer aussi mes journées déjà renseignées").check();
    await copy.getByRole("button", { name: "Prévisualiser la copie" }).click();
    await copy.getByRole("button", { name: "Confirmer ces disponibilités" }).click();
    await expect(copy.getByText("Disponibilités enregistrées.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    checked(await admin.from("availability_days").delete().eq("membership_id", member.id));
    checked(await admin.from("memberships").delete().eq("id", member.id));
    checked(await admin.from("profiles").delete().eq("user_id", account.id));
    checked(await admin.auth.admin.deleteUser(account.id));
  }
});
