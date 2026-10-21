import { expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { test } from "./fixtures";
import { clients, checked } from "../../scripts/local-supabase.mjs";

test("un administrateur consulte l’état technique sans activer les rappels", async ({ page }) => {
  await page.goto("/groupe/reglages");
  const details = page.locator("details").filter({ has: page.getByText("Suivi du traitement (administration)", { exact: true }) });
  await details.locator("summary").click();
  await expect(details.getByRole("heading", { name: "État technique", exact: true })).toBeVisible();
  await expect(details.getByText("Les rappels automatiques sont désactivés.", { exact: true })).toBeVisible();
  await expect(details.getByText(/Ce contrôle ne vérifie ni la livraison réelle du Push/)).toBeVisible();
  await expect(details.getByRole("button")).toHaveCount(0);
});

test("un membre ne reçoit pas les diagnostics après retrait de son rôle administrateur", async ({ page, authCookies }) => {
  const { admin, config } = clients();
  const actor = createServerClient(config.url, config.key, { cookies: { getAll: () => authCookies.map(({ name, value }) => ({ name, value })), setAll: () => {} } });
  const { user } = checked(await actor.auth.getUser());
  if (!user) throw new Error("Compte de recette absent.");
  checked(await admin.from("memberships").update({ role: "member" }).eq("user_id", user.id));
  await page.goto("/groupe/reglages");
  await expect(page.getByRole("heading", { name: "Mes réglages.", exact: true })).toBeVisible();
  await expect(page.getByText("Suivi du traitement (administration)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "État technique", exact: true })).toHaveCount(0);
  expect((await actor.rpc("notification_job_status")).error).toBeTruthy();
});
