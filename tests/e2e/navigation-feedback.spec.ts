import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("un onglet réagit même lorsque sa réponse réseau est retenue", async ({ page }) => {
  let resume!:()=>void;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  let held=false;
  await page.route(url=>url.pathname==="/sessions"&&url.searchParams.has("_rsc"),async route=>{held=true;await gate;await route.continue().catch(()=>{});});
  await page.goto("/accueil");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  const click=page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Soirées",exact:true}).click();
  try {
    await expect(page.getByRole("status").filter({hasText:/Chargement de Soirées|Un petit instant/}).first()).toBeVisible();
    expect(held).toBe(true);
  } finally {resume();await click;}
  await expect(page.getByRole("heading",{level:1})).toHaveText("Vos soirées.");
});
