import {expect} from "@playwright/test";
import {test} from "./fixtures";

test.use({serviceWorkers:"block"});

test("un ancien contrôle lent ne bloque pas les onglets suivants",async({page})=>{
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  let resume!:()=>void,requests=0;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{
    if(++requests===1){await gate;await route.fulfill({status:503,contentType:"application/json",body:"{}"});}
    else await route.continue();
  });
  const nav=page.getByRole("navigation",{name:"Navigation principale"});
  const oldResponse=page.waitForResponse(response=>response.url().endsWith("/api/session-status")&&response.status()===503);
  try{
    await nav.getByRole("link",{name:"Dispos",exact:true}).click();
    await expect(page.locator(".day-editor")).toHaveCount(7);
    await expect.poll(()=>requests).toBe(1);
    await nav.getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(page).toHaveURL(/\/accueil$/);
    await nav.getByRole("link",{name:"Groupe",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
  }finally{resume();}
  await oldResponse;
  await expect(page.locator(".navigation-error")).toHaveCount(0);
  await expect(page).toHaveURL(/\/groupe$/);
});

test("Actualiser indique l’attente et empêche les doubles demandes",async({page})=>{
  await page.goto("/groupe");await page.waitForLoadState("networkidle");
  let resume!:()=>void,requests=0;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{requests++;await gate;await route.continue().catch(()=>{});});
  const refresh=page.getByRole("button",{name:"Actualiser les informations du groupe",exact:true});
  try{
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute("aria-busy","true");
    await expect(refresh.getByRole("status")).toHaveText("Actualisation…");
    expect(requests).toBe(1);
  }finally{resume();}
  await expect(refresh).toBeEnabled();
  await expect(refresh).toHaveAttribute("aria-busy","false");
  await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
});

test("l’onglet courant ne déclenche aucun aller-retour inutile",async({page})=>{
  await page.goto("/dispos");await page.waitForLoadState("networkidle");
  const requests:string[]=[];
  page.on("request",request=>{
    const url=new URL(request.url());
    if(url.pathname==="/api/session-status"||url.searchParams.has("_rsc"))requests.push(url.pathname);
  });
  const current=page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true});
  await current.click();await current.click();
  await expect(current).toHaveAttribute("aria-current","page");
  await expect(page.locator(".day-editor")).toHaveCount(7);
  expect(requests).toEqual([]);
});

test("les onglets reçus s’affichent avant le contrôle réseau, même sans animations",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:390,height:844});
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  let resume!:()=>void;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{await gate;await route.continue().catch(()=>{});});
  const check=page.waitForResponse(response=>response.url().endsWith("/api/session-status"));
  const tab=page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true});
  try{
    await tab.click();
    await expect(page).toHaveURL(/\/dispos$/);
    await expect(page.locator(".day-editor")).toHaveCount(7);
    await expect(tab.locator(".nav-content")).toHaveAttribute("aria-busy","false");
    await expect(page.locator(".nav-loading")).toHaveCount(0);
    await expect(page.locator(".page-enter")).toHaveCSS("animation-name","none");
    await page.locator(".day-editor").first().getByRole("button",{name:/Horaires du/}).click();
    await expect(page.getByRole("dialog")).toHaveCSS("animation-name","none");
    await page.screenshot({path:info.outputPath("onglet-sans-attente.png"),fullPage:true});
  }finally{resume();await check;}
});

test("le retour vers un onglet reçu n’attend plus le contrôle réseau",async({page})=>{
  await page.goto("/groupe");await page.waitForLoadState("networkidle");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
  await expect(page).toHaveURL(/\/dispos$/);await page.waitForLoadState("networkidle");
  let resume!:()=>void;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{await gate;await route.continue().catch(()=>{});});
  const check=page.waitForResponse(response=>response.url().endsWith("/api/session-status"));
  try{
    await page.goBack();
    await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
    await expect(page.locator(".navigation-check")).toHaveCount(0);
  }finally{resume();await check;}
});
