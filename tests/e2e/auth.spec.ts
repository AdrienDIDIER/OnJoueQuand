import { expect } from "@playwright/test";
import {test as anonymousTest,postponeInstallation} from "./browser";
import { randomUUID } from "node:crypto";
import { test } from "./fixtures";
import { clients, checked, mailboxCode } from "../../scripts/local-supabase.mjs";
import { sendEmailCode } from "../../src/features/auth/infrastructure/email-code";

anonymousTest("les quatre pages privées redirigent sans session", async ({ page }, testInfo) => {
  for (const route of ["accueil", "dispos", "sessions", "groupe", "groupe/reglages", "groupe/jeux", "groupe/gestion", "dispos/groupe", "dispos/trouver"]) {
    await page.goto(`/${route}`);
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Content de vous retrouver.");
  }
  await page.screenshot({ path: testInfo.outputPath("connexion.png"), fullPage: true });
});

anonymousTest("adresse inconnue : réponse générique et aucun compte créé", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(`inconnu-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByText("Si cette adresse est autorisée", { exact: false })).toBeVisible();
});

test("inviter, rejoindre par OTP, modifier son profil puis perdre l’accès", async ({ page, browser }) => {
  const email = `parcours-${randomUUID()}@example.test`;
  const { config } = clients();
  await page.goto("/groupe/gestion");
  await page.getByLabel("Adresse e-mail à inviter").fill(email);
  await page.getByRole("button", { name: "Inviter cette personne" }).click();
  await expect(page.getByText("Invitation envoyée.", { exact: false })).toBeVisible();
  const code = await mailboxCode(config.mailUrl, email);
  const context = await browser.newContext();await postponeInstallation(context);
  const invitee = await context.newPage();
  await invitee.goto("http://127.0.0.1:3100/connexion");
  await invitee.getByLabel("Adresse e-mail du code").fill(email);
  await invitee.getByLabel("Code à six chiffres").fill(code);
  await invitee.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(invitee).toHaveURL(/\/rejoindre$/);
  const name = `Joueur ${randomUUID().slice(0, 8)}`;
  await invitee.getByLabel("Votre nom dans le groupe").fill(name);
  await invitee.getByRole("button", { name: "Accepter mon invitation" }).click();
  await expect(invitee).toHaveURL(/\/accueil$/);
  await invitee.goto("http://127.0.0.1:3100/groupe/reglages");
  await expect(invitee.getByRole("heading", { name: "Invitations", exact: true })).toHaveCount(0);
  await invitee.getByText("Mon profil",{exact:true}).click();
  await invitee.getByLabel("Votre nom dans le groupe").fill(`${name} bis`);
  await invitee.getByRole("button", { name: "Enregistrer mon profil" }).click();
  await expect(invitee.getByText("Profil enregistré.")).toBeVisible();
  await page.reload();
  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: `${name} bis`, exact: true }) });
  await row.getByRole("button", { name: "Retirer l’accès" }).click();
  await expect(row.getByText("Accès retiré", { exact: false })).toBeVisible();
  await invitee.reload();
  await expect(invitee).toHaveURL(/\/rejoindre$/);
  await invitee.getByRole("button", { name: "Changer de compte" }).click();
  await expect(invitee).toHaveURL(/\/connexion$/);
  await context.close();
});

anonymousTest("un compte Auth sans adhésion reste à l’entrée du groupe", async ({ page }) => {
  const { admin, anonymous, config } = clients();
  const email = `externe-ui-${randomUUID()}@example.test`;
  checked(await admin.auth.admin.createUser({ email, email_confirm: false }));
  checked(await sendEmailCode(anonymous(), email));
  const code = await mailboxCode(config.mailUrl, email);
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail du code").fill(email);
  await page.getByLabel("Code à six chiffres").fill(code);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/rejoindre$/);
  await page.getByLabel("Votre nom dans le groupe").fill("Sans invitation");
  await page.getByRole("button", { name: "Accepter mon invitation" }).click();
  await expect(page.getByText("Aucune invitation valide pour ce compte.", { exact: false })).toBeVisible();
});
