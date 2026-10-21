import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { test } from "./fixtures";

test("une session supprimée ou une référence invalide donne une explication française", async ({ page }) => {
  for (const id of [randomUUID(), "reference-invalide"]) {
    await page.goto(`/sessions?session=${id}`);
    await expect(page.getByText("Cette soirée n’est plus disponible.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir toutes les soirées", exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Voir toutes les soirées", exact: true }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.getByText("Cette soirée n’est plus disponible.", { exact: true })).toHaveCount(0);
});
