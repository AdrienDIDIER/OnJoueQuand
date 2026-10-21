import {expect,type Page} from "@playwright/test";
import {test} from "./fixtures";
import {createServer,request as httpRequest} from "node:http";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {createServerClient} from "@supabase/ssr";
import {clients,checked} from "../../scripts/local-supabase.mjs";
async function controlled(page:Page){
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(navigator.serviceWorker.controller)return;await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
}
async function appProxy(worker:()=>string,blocked:(url:string)=>boolean=()=>false){
  const proxy=createServer((req,res)=>{
    if(blocked(req.url??"")){res.destroy();return;}
    if(req.url==="/sw.js"){res.writeHead(200,{"Content-Type":"application/javascript","Cache-Control":"no-store","Service-Worker-Allowed":"/"});res.end(worker());return;}
    const upstream=httpRequest({hostname:"127.0.0.1",port:3100,path:req.url,method:req.method,headers:{...req.headers,host:"127.0.0.1:3100","x-forwarded-host":req.headers.host??"","x-forwarded-proto":"http"}},response=>{res.writeHead(response.statusCode??502,response.headers);response.pipe(res);});upstream.on("error",()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });
  await new Promise<void>(resolve=>proxy.listen(0,"127.0.0.1",resolve));const address=proxy.address();if(!address||typeof address==="string")throw new Error("Proxy de recette indisponible.");
  return{origin:`http://127.0.0.1:${address.port}`,close:async()=>{proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));}};
}
test("manifeste, icônes et repli hors connexion sans données privées",async({page,request},info)=>{
  const response=await request.get("/manifest.webmanifest");expect(response.status()).toBe(200);const manifest=await response.json();
  expect(manifest).toMatchObject({id:"/",lang:"fr",start_url:"/accueil",scope:"/",display:"standalone"});
  for(const [path,size] of [["icon-192",192],["icon-512",512],["maskable-512",512],["apple-touch-icon",180]] as const){const icon=await request.get(`/icons/${path}.png`);expect(icon.status()).toBe(200);const png=await icon.body();expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);}
  let unavailable=false;const proxy=await appProxy(()=>readFileSync("public/sw.js","utf8"),()=>unavailable);
  try{
  await page.goto(`${proxy.origin}/sessions`);await controlled(page);
  await page.getByRole("button",{name:"Proposer une session",exact:true}).click();const sentinel=`Brouillon privé ${randomUUID()}`;await page.getByLabel("Titre de la session",{exact:true}).fill(sentinel);
  await page.context().setOffline(true);
  await page.getByRole("button",{name:"Enregistrer le brouillon",exact:true}).click();await expect(page.getByLabel("Titre de la session",{exact:true})).toHaveValue(sentinel);await expect(page.getByText("Enregistrement impossible hors connexion.",{exact:false})).toBeVisible();
  const apiFallback=await page.evaluate(async()=>{try{const response=await fetch("/api/session-status",{cache:"no-store"});return(response.headers.get("content-type")??"").includes("text/html");}catch{return false;}});expect(apiFallback).toBe(false);
  // La panne du récepteur couvre aussi Firefox, où le mode offline émulé peut laisser le réseau du SW actif.
  unavailable=true;await page.goto(`${proxy.origin}/groupe?source=recette`);await expect(page.getByRole("heading",{level:1})).toHaveText("Vous êtes hors connexion.");await expect(page.locator("body")).not.toContainText(sentinel);await expect(page.getByRole("textbox")).toHaveCount(0);await page.screenshot({path:info.outputPath("hors-connexion.png")});
  const cache=await page.evaluate(async()=>{const names=await caches.keys();const paths:string[]=[];for(const name of names){for(const r of await(await caches.open(name)).keys())paths.push(new URL(r.url).pathname);}return paths.sort();});expect(cache).toEqual(["/icons/apple-touch-icon.png","/icons/icon-192.png","/icons/icon-512.png","/icons/maskable-512.png","/offline.html"]);
  unavailable=false;await page.context().setOffline(false);await page.getByRole("link",{name:"Réessayer"}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("On se retrouve ?");
  await page.goto(`${proxy.origin}/groupe/reglages`);await page.getByRole("button",{name:"Me déconnecter",exact:true}).click();await expect(page).toHaveURL(/\/connexion$/);await page.goto(`${proxy.origin}/groupe/reglages`);await expect(page).toHaveURL(/\/connexion$/);
  }finally{await page.context().setOffline(false);await page.goto("about:blank");await proxy.close();}
});
test("installation volontaire et report sans bloquer la navigation",async({page})=>{
  await page.goto("/groupe/reglages");await controlled(page);await page.getByText("Installer OnJoueQuand",{exact:true}).click();
  await page.evaluate(()=>{document.documentElement.dataset.promptCount="0";const event=new Event("beforeinstallprompt",{cancelable:true});Object.defineProperties(event,{prompt:{value:async()=>{document.documentElement.dataset.promptCount="1";}},userChoice:{value:Promise.resolve({outcome:"dismissed"})}});window.dispatchEvent(event);});
  await expect(page.locator("html")).toHaveAttribute("data-prompt-count","0");
  await page.getByRole("button",{name:"Installer l’application",exact:true}).click();await expect(page.getByText("Installation reportée.",{exact:false})).toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-prompt-count","1");
  await page.getByRole("navigation").getByRole("link",{name:"Sessions",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("Vos sessions.");
});
test("reprise de focus : saisie conservée et accès révoqué recontrôlé",async({page,request})=>{
  expect((await request.get("/api/session-status")).status()).toBe(401);
  await page.goto("/groupe/reglages");await page.getByText("Mon profil",{exact:true}).click();await controlled(page);const input=page.getByLabel("Votre nom dans le groupe",{exact:true});await input.fill("Saisie à conserver au premier plan");
  const verified=page.waitForResponse(response=>response.url().endsWith("/api/session-status")&&response.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event("focus")));const active=await verified;expect(active.headers()["cache-control"]).toContain("no-store");await expect(input).toHaveValue("Saisie à conserver au premier plan");
  const {admin,config}=clients();const cookies=await page.context().cookies();const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>cookies.map(({name,value})=>({name,value})),setAll:()=>{}}});const user=checked(await client.auth.getUser()).user;if(!user)throw new Error("Compte de recette absent.");
  checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",user.id));
  const denied=page.waitForResponse(response=>response.url().endsWith("/api/session-status")&&response.status()===403);await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await denied;await expect(page).toHaveURL(/\/connexion$/);await expect(input).toHaveCount(0);
});
test("une mise à jour réelle attend et préserve les formulaires des autres onglets",async({page,context})=>{
  test.setTimeout(60_000);page.setDefaultTimeout(10_000);let version=1;const marker=randomUUID();const original=readFileSync("public/sw.js","utf8");
  // Origine locale isolée : vrai changement de script SW, sans modifier les fichiers ni les autres tests.
  const proxy=await appProxy(()=>original.replace('ojq-public-v1',`ojq-public-${marker}-${version}`));const url=`${proxy.origin}/groupe/reglages`;
  const other=await context.newPage();
  other.setDefaultTimeout(10_000);
  try{
    await page.goto(url);await controlled(page);await other.goto(url);await controlled(other);
    await page.getByText("Mon profil",{exact:true}).click();await other.getByText("Mon profil",{exact:true}).click();
    const input=page.getByLabel("Votre nom dans le groupe",{exact:true}),otherInput=other.getByLabel("Votre nom dans le groupe",{exact:true});const initial=await input.inputValue();await input.fill("Saisie du premier onglet");await otherInput.fill("Saisie conservée dans l’autre onglet");
    await page.evaluate(async()=>{await caches.open("ojq-public-obsolete");await caches.open("cache-autre-application");});
    version=2;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration())?.update();});
    const update=page.getByRole("region",{name:"Mise à jour disponible",exact:true});await expect(update).toBeVisible();await expect(update.getByRole("button",{name:"Actualiser l’application"})).toBeDisabled();await expect(input).toHaveValue("Saisie du premier onglet");
    await update.getByRole("checkbox").check();await Promise.all([page.waitForEvent("framenavigated",frame=>frame===page.mainFrame()),update.getByRole("button",{name:"Actualiser l’application"}).click()]);
    expect(initial).toBeTruthy();expect(await page.evaluate(()=>(performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type)).toBe("reload");await expect(otherInput).toHaveValue("Saisie conservée dans l’autre onglet");await expect(other.getByRole("region",{name:"Mise à jour disponible"})).toBeVisible();
    const otherUpdate=other.getByRole("region",{name:"Mise à jour disponible"});await otherUpdate.getByRole("checkbox").check();await Promise.all([other.waitForEvent("framenavigated",frame=>frame===other.mainFrame()),otherUpdate.getByRole("button",{name:"Actualiser l’application"}).click()]);expect(await other.evaluate(()=>(performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type)).toBe("reload");
    const keys=await page.evaluate(()=>caches.keys());expect(keys).toContain(`ojq-public-${marker}-2`);expect(keys).not.toContain("ojq-public-obsolete");expect(keys).not.toContain(`ojq-public-${marker}-1`);expect(keys).toContain("cache-autre-application");
  }finally{await other.close().catch(()=>{});await page.goto("about:blank").catch(()=>{});await proxy.close();}
});
