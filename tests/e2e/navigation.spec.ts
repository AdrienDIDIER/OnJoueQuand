import { expect } from "@playwright/test";
import { test } from "./fixtures";

const routes = [
  { path: "/accueil", label: "Accueil", heading: "Bienvenue chez vous." },
  { path: "/dispos", label: "Dispos", heading: "Vos disponibilités." },
  { path: "/sessions", label: "Sessions", heading: "Vos sessions." },
  { path: "/groupe", label: "Groupe", heading: "Votre groupe." },
];

for (const route of routes) {
  test(`${route.label} : route française, navigation et affichage responsive`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.getByRole("link", { name: route.label, exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    if (route.path === "/groupe") await page.screenshot({ path: testInfo.outputPath("groupe.png"), fullPage: true });
  });
}

test("les quatre onglets sont réellement navigables", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/accueil$/);
  for (const route of routes) {
    await page.getByRole("navigation").getByRole("link", { name: route.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
  }
});

test("le clavier permet de rejoindre directement le contenu", async ({ page, browserName }) => {
  // WinCairo headless ne donne pas le focus au document sous Windows.
  // Ce test reste obligatoire sur WebKit Linux dans la CI, sans contournement du focus.
  test.skip(browserName === "webkit" && process.platform === "win32", "Focus natif indisponible sur WebKit headless Windows ; couvert sous Linux.");
  await page.goto("/accueil");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.bringToFront();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenu")).toBeFocused();
});

test("la page introuvable reste en français", async ({ page }) => {
  const response = await page.goto("/introuvable");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cette page n’existe pas.");
  await page.getByRole("link", { name: "Retour à l’accueil" }).click();
  await expect(page).toHaveURL(/\/accueil$/);
});

test("aperçu du shell", async ({ page }, testInfo) => {
  await page.goto("/accueil");
  await page.screenshot({ path: testInfo.outputPath("accueil.png"), fullPage: true });
});
