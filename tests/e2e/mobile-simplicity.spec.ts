import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { clients, checked } from "../../scripts/local-supabase.mjs";
import { createServerClient } from "@supabase/ssr";

test("sur téléphone, les écrans quotidiens ne présentent pas les réglages", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["accueil", "dispos", "sessions", "groupe"]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if(route==="accueil") await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toBeVisible();
    await page.locator(".page-enter").evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    await expect(page.getByRole("button", { name: "Me déconnecter", exact: true })).toHaveCount(0);
    await expect(page.getByText("Installer OnJoueQuand", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Votre nom dans le groupe", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${route}-telephone.png`), fullPage: true });
  }
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  await page.getByRole("link", { name: /Mes réglages Notifications et profil/ }).click();
  await expect(page.getByRole("heading", { name: "Mes réglages.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activer sur cet appareil", exact: true })).toBeVisible();
  await expect(page.getByLabel("Votre nom dans le groupe", { exact: true })).not.toBeVisible();
  await page.getByText("Mon profil", { exact: true }).click();
  await expect(page.getByLabel("Votre nom dans le groupe", { exact: true })).toBeVisible();
});

test("un membre ne peut pas ouvrir directement la gestion du groupe", async ({ page, authCookies }) => {
  const { admin, config } = clients();
  const actor = createServerClient(config.url, config.key, { cookies: { getAll: () => authCookies.map(({ name, value }) => ({ name, value })), setAll: () => {} } });
  const { user } = checked(await actor.auth.getUser());
  if (!user) throw new Error("Compte de recette absent.");
  checked(await admin.from("memberships").update({ role: "member" }).eq("user_id", user.id));
  await page.goto("/groupe/gestion");
  await expect(page).toHaveURL(/\/groupe$/);
  await expect(page.getByLabel("Adresse e-mail à inviter")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Gérer le groupe/ })).toHaveCount(0);
});

test("répondre en un geste enregistre la journée et refuse une page périmée", async ({ page, context, authCookies }) => {
  const { admin, config } = clients();
  const actor = createServerClient(config.url, config.key, { cookies: { getAll: () => authCookies.map(({ name, value }) => ({ name, value })), setAll: () => {} } });
  const { user } = checked(await actor.auth.getUser());
  if (!user) throw new Error("Compte de recette absent.");
  const member = checked(await actor.from("memberships").select("id").eq("user_id",user.id).single());
  const other = await context.newPage();
  try {
    await page.goto("/dispos"); await other.goto("/dispos");
    const day = page.locator(".day-editor").first();
    await day.getByRole("button",{name:"Dispo 20:00–23:00",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Mes réponses · 1/7"})).toBeVisible();
    await expect(day.getByRole("button",{name:"Dispo 20:00–23:00",exact:true})).toHaveAttribute("aria-pressed","true");
    const saved = checked(await actor.from("availability_days").select("status,mode,availability_intervals(starts_at,ends_at)").eq("membership_id",member.id).single());
    expect(saved.status).toBe("available"); expect(saved.mode).toBe("quick"); expect(saved.availability_intervals).toHaveLength(1);
    await other.locator(".day-editor").first().getByRole("button",{name:"Indispo",exact:true}).click();
    await expect(other.getByRole("status").filter({hasText:"Disponibilités modifiées"})).toBeVisible();
    expect(checked(await actor.from("availability_days").select("status").eq("membership_id",member.id).single()).status).toBe("available");
  } finally {
    await other.close();
    checked(await admin.from("availability_days").delete().eq("membership_id",member.id));
  }
});

test("la semaine tient dans une liste courte et les horaires s’ouvrent au bon endroit", async ({ page }, info) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/dispos");
  await expect(page.getByRole("group").filter({has:page.locator(".quick-reply")})).toHaveCount(7);
  expect(await page.locator(".week-board").evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(650);
  await expect(page.getByRole("heading",{name:"Les jeux du groupe",exact:true})).toHaveCount(0);
  const trigger=page.locator(".day-editor").first().getByRole("button",{name:/Horaires du/});
  await trigger.click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox",{name:"Votre réponse",exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Fermer",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.screenshot({path:info.outputPath("semaine-compacte.png"),fullPage:true});
  await page.getByRole("link",{name:"Le groupe",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Les dispos du groupe.");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
