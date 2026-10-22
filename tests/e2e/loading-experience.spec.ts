import {expect} from "@playwright/test";
import {test} from "./fixtures";

test.use({serviceWorkers:"block"});

test("revenir sur l’onglet courant annule une intention encore en attente",async({page})=>{
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
    await expect(nav.locator(".nav-loading")).toBeVisible();
    await nav.getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(nav.locator(".nav-loading")).toHaveCount(0);
    expect(requests).toBe(1);
  }finally{resume();}
  await oldResponse;
  await nav.getByRole("link",{name:"Groupe",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
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

test("une vérification lente reste visible puis s’efface, même sans animations",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  let resume!:()=>void;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{await gate;await route.continue().catch(()=>{});});
  const tab=page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true});
  try{
    await tab.click();
    await expect(tab.locator(".nav-content")).toHaveAttribute("aria-busy","true");
    await expect(tab.locator(".nav-loading")).toBeVisible();
    await expect(page.getByRole("heading",{level:1})).toHaveText("On se retrouve ?");
    expect(await tab.locator(".nav-loading").evaluate(node=>getComputedStyle(node,"::after").animationName)).toBe("none");
    await page.screenshot({path:info.outputPath("navigation-en-attente.png"),fullPage:true});
  }finally{resume();}
  await expect(page).toHaveURL(/\/dispos$/);
  await expect(page.locator(".nav-loading")).toHaveCount(0);
  await expect(page.locator(".page-enter")).toHaveCSS("animation-name","none");
  await page.locator(".day-editor").first().getByRole("button",{name:/Horaires du/}).click();
  await expect(page.getByRole("dialog")).toHaveCSS("animation-name","none");
});

test("le retour navigateur présente un aperçu neutre jusqu’à la vérification des droits",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/groupe");await page.waitForLoadState("networkidle");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
  await expect(page).toHaveURL(/\/dispos$/);
  let resume!:()=>void;
  const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/session-status",async route=>{await gate;await route.continue().catch(()=>{});});
  const back=page.goBack();
  try{
    const placeholder=page.getByRole("status").filter({hasText:"On retrouve votre groupe…"});
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toHaveAttribute("aria-busy","true");
    await expect(page.getByRole("heading",{name:"Les membres",exact:true})).not.toBeVisible();
    expect(await placeholder.locator(".loading-art").getAttribute("aria-hidden")).toBe("true");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("chargement-telephone.png"),fullPage:true});
  }finally{resume();await back;}
  await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
  await expect(page.locator(".navigation-check")).toHaveCount(0);
});
