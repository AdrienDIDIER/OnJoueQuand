import {expect,type Page} from "@playwright/test";
import {test} from "./fixtures";
import {createECDH,randomBytes,randomUUID} from "node:crypto";
import {createServerClient} from "@supabase/ssr";
import {clients,checked} from "../../scripts/local-supabase.mjs";

function subscription(){const key=createECDH("prime256v1");key.generateKeys();return{endpoint:`https://web.push.apple.com/recette/${randomUUID()}`,keys:{p256dh:key.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}};}
async function simulate(page:Page,{installed=true,permission="default",choice="granted",device=subscription(),existing=false}:{installed?:boolean;permission?:NotificationPermission;choice?:NotificationPermission;device?:ReturnType<typeof subscription>;existing?:boolean}={}){
  await page.addInitScript(({installed,permission,choice,device,existing})=>{
    let current=permission,subscribed=existing;
    const original=window.matchMedia.bind(window);
    window.matchMedia=query=>{const result=original(query);if(query==="(display-mode: standalone)")Object.defineProperty(result,"matches",{value:installed});return result;};
    document.addEventListener("DOMContentLoaded",()=>{document.documentElement.dataset.permissionRequests="0";});
    Object.defineProperty(window,"Notification",{configurable:true,value:{get permission(){return current;},requestPermission:async()=>{document.documentElement.dataset.permissionRequests=String(Number(document.documentElement.dataset.permissionRequests)+1);current=choice;return choice;}}});
    Object.defineProperty(window,"PushManager",{configurable:true,value:function(){}});
    const value={endpoint:device.endpoint,toJSON:()=>device,unsubscribe:async()=>true};
    const registration={pushManager:{getSubscription:async()=>subscribed?value:null,subscribe:async()=>{subscribed=true;return value;}},waiting:null,installing:null,addEventListener(){},removeEventListener(){}};
    Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{controller:null,ready:Promise.resolve(registration),register:async()=>registration,getRegistration:async()=>registration,addEventListener(){},removeEventListener(){}}});
  },{installed,permission,choice,device,existing});
  return device;
}
async function actor(cookies:{name:string;value:string}[]){
  const {admin,config}=clients();const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>cookies,setAll:()=>{}}});
  const user=checked(await client.auth.getUser()).user;if(!user)throw new Error("Compte de recette absent.");
  const member=checked(await client.from("memberships").select("id").eq("user_id",user.id).single());return{admin,client,member};
}

test("depuis l’icône, proposer sans demander automatiquement et mémoriser Plus tard",async({page},info)=>{
  await simulate(page);await page.goto("/accueil");
  const invitation=page.getByRole("dialog",{name:"On vous prévient ?",exact:true});
  await expect(invitation).toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
  await page.screenshot({path:info.outputPath("activer-notifications.png")});
  await invitation.getByRole("button",{name:"Plus tard",exact:true}).click();
  await page.reload();await page.waitForTimeout(1500);await expect(invitation).not.toBeVisible();
});
test("Activer demande la permission puis enregistre l’appareil et sa préférence",async({page,authCookies})=>{
  const device=await simulate(page);await page.goto("/accueil");
  const invitation=page.getByRole("dialog",{name:"On vous prévient ?",exact:true});await expect(invitation).toBeVisible();
  await invitation.getByRole("button",{name:"Activer les notifications",exact:true}).click();await expect(invitation).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","1");
  const {client}=await actor(authCookies);
  expect(checked(await client.from("push_subscriptions").select("id").eq("endpoint",device.endpoint))).toHaveLength(1);
  expect(checked(await client.from("notification_preferences").select("push_enabled").single()).push_enabled).toBe(true);
});
test("un refus reste explicite et permet de continuer sans insister",async({page})=>{
  await simulate(page,{choice:"denied"});await page.goto("/accueil");
  const invitation=page.getByRole("dialog",{name:"On vous prévient ?",exact:true});await expect(invitation).toBeVisible();
  await invitation.getByRole("button",{name:"Activer les notifications",exact:true}).click();
  await expect(invitation.getByRole("status")).toContainText("Autorisation non accordée");
  await expect(invitation.getByRole("button",{name:"Activer les notifications",exact:true})).toHaveCount(0);
  await invitation.getByRole("button",{name:"Continuer sans notifications",exact:true}).click();await expect(invitation).not.toBeVisible();
});
test("aucune sollicitation dans un simple onglet du navigateur",async({page})=>{
  await simulate(page,{installed:false});await page.goto("/accueil");await page.waitForTimeout(1500);
  await page.evaluate(()=>window.dispatchEvent(new Event("appinstalled")));
  await page.waitForTimeout(1300);
  await expect(page.getByRole("dialog",{name:"On vous prévient ?",exact:true})).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
});
test("respecter une préférence Push explicitement désactivée",async({page,authCookies})=>{
  const {client}=await actor(authCookies);
  checked(await client.rpc("notification_command",{command:"preferences",expected_revision:null,payload:{push_enabled:false,reminders_enabled:true}}));
  await simulate(page);await page.goto("/accueil");await page.waitForTimeout(1700);
  await expect(page.getByRole("dialog",{name:"On vous prévient ?",exact:true})).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
});
test("un appareil déjà activé ne reçoit pas de nouvelle invitation",async({page,authCookies})=>{
  const device=subscription(),{client}=await actor(authCookies);
  checked(await client.rpc("notification_command",{command:"subscribe",expected_revision:null,payload:{endpoint:device.endpoint,...device.keys}}));
  await simulate(page,{permission:"granted",device,existing:true});await page.goto("/accueil");await page.waitForTimeout(1700);
  await expect(page.getByRole("dialog",{name:"On vous prévient ?",exact:true})).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
});
test("une permission déjà bloquée ne déclenche aucune demande",async({page})=>{
  await simulate(page,{permission:"denied"});await page.goto("/accueil");await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog",{name:"On vous prévient ?",exact:true})).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
});

test("terminer une inscription manquante sans redemander une permission accordée",async({page,authCookies})=>{
  const device=await simulate(page,{permission:"granted"});await page.goto("/accueil");
  const invitation=page.getByRole("dialog",{name:"On vous prévient ?",exact:true});await expect(invitation).toBeVisible();
  await invitation.getByRole("button",{name:"Activer les notifications",exact:true}).click();await expect(invitation).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests","0");
  const {client}=await actor(authCookies);
  expect(checked(await client.from("push_subscriptions").select("id").eq("endpoint",device.endpoint))).toHaveLength(1);
});
