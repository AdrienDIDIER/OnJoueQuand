import {expect} from "@playwright/test";
import {test} from "./fixtures";
import {createServerClient} from "@supabase/ssr";
import {clients,checked} from "../../scripts/local-supabase.mjs";

// Les simulations réseau doivent atteindre Playwright, sans interception du worker.
// Le worker et sa confidentialité ont leur propre recette pwa.spec.ts.
test.use({serviceWorkers:"block"});

async function actor(cookies:{name:string;value:string}[]) {
  const {admin,config}=clients();
  const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>cookies,setAll:()=>{}}});
  const {user}=checked(await client.auth.getUser());
  if(!user)throw new Error("Compte de recette absent.");
  const member=checked(await client.from("memberships").select("id").eq("user_id",user.id).single());
  return{admin,client,user,member,config};
}

test("les onglets préchargés réutilisent leur page avec une vérification fraîche",async({page})=>{
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  let contents=0,checks=0;
  page.on("request",request=>{const url=new URL(request.url());if(url.searchParams.has("_rsc")&&!request.headers()["next-router-prefetch"])contents++;if(url.pathname==="/api/session-status")checks++;});
  const nav=page.getByRole("navigation",{name:"Navigation principale"});
  for(const name of ["Dispos","Soirées","Groupe","Accueil","Dispos"]){
    const checkedAccess=page.waitForResponse(response=>response.url().endsWith("/api/session-status")&&response.status()===200);
    await nav.getByRole("link",{name,exact:true}).click();await checkedAccess;
    await expect(nav.getByRole("link",{name,exact:true})).toHaveAttribute("aria-current","page");
  }
  expect(contents).toBe(0);expect(checks).toBe(5);
});

test("une modification invalide aussi l’accueil préchargé",async({page,authCookies})=>{
  const {admin,member}=await actor(authCookies);
  try {
    await page.goto("/accueil");await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toContainText("0/7");
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
    await page.locator(".day-editor").nth(4).getByRole("button",{name:"Dispo 20:00–23:00",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Mes réponses · 1/7"})).toBeVisible();
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toContainText("1/7");
    const marks=page.locator(".week-progress i");
    await expect(marks).toHaveCount(7);
    await expect(marks.nth(0)).toHaveAttribute("data-status","unanswered");
    await expect(marks.nth(4)).toHaveAttribute("data-status","available");
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
    await page.locator(".day-editor").nth(1).getByRole("button",{name:"Indispo",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Mes réponses · 2/7"})).toBeVisible();
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(marks.nth(1)).toHaveAttribute("data-status","unavailable");
    await expect(marks.nth(4)).toHaveAttribute("data-status","available");
  } finally {checked(await admin.from("availability_days").delete().eq("membership_id",member.id));}
});

test("un rôle modifié ne peut pas réafficher une vue administrateur en cache",async({page,authCookies})=>{
  const {admin,user}=await actor(authCookies);
  await page.goto("/groupe");await expect(page.getByRole("link",{name:/Gérer le groupe/})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
  await expect(page).toHaveURL(/\/accueil$/);
  checked(await admin.from("memberships").update({role:"member"}).eq("user_id",user.id));
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Groupe",exact:true}).click();
  await expect(page).toHaveURL(/\/groupe$/);
  await expect(page.getByRole("heading",{name:"Votre groupe.",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:/Gérer le groupe/})).toHaveCount(0);
});

test("un accès révoqué bloque le retour sur un onglet déjà en mémoire",async({page,authCookies})=>{
  const {admin,user}=await actor(authCookies);
  await page.goto("/dispos");await expect(page.locator(".day-editor")).toHaveCount(7);
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
  await expect(page).toHaveURL(/\/accueil$/);
  checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",user.id));
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
  await expect(page).toHaveURL(/\/connexion$/);await expect(page.locator(".day-editor")).toHaveCount(0);
});

test("une vérification indisponible ne révèle pas la destination en cache",async({page})=>{
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  await page.route("**/api/session-status",route=>route.fulfill({status:503,contentType:"application/json",body:'{"message":"Indisponible"}'}));
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Dispos",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Connexion au groupe impossible"})).toBeVisible();
  await expect(page).toHaveURL(/\/accueil$/);await expect(page.locator(".day-editor")).toHaveCount(0);
});

test("le retour navigateur recontrôle les droits avant l’affichage de l’historique",async({page,authCookies})=>{
  const {admin,user}=await actor(authCookies);
  await page.goto("/groupe/gestion");await expect(page.getByLabel("Adresse e-mail à inviter")).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
  await expect(page).toHaveURL(/\/accueil$/);
  checked(await admin.from("memberships").update({role:"member"}).eq("user_id",user.id));
  await page.goBack();
  await expect(page).toHaveURL(/\/groupe$/);await expect(page.getByLabel("Adresse e-mail à inviter")).toHaveCount(0);
});

test("un changement de compte écarte les vues privées du précédent",async({page,context,authCookies})=>{
  const {admin,user,member,config}=await actor(authCookies);
  checked(await admin.from("profiles").update({display_name:"Recette compte A"}).eq("user_id",user.id));
  const account=checked(await admin.auth.admin.createUser({email:`cache-b-${crypto.randomUUID()}@example.test`,email_confirm:true})).user;
  const group=checked(await admin.from("memberships").select("group_id").eq("id",member.id).single());
  checked(await admin.from("profiles").insert({user_id:account.id,display_name:"Recette compte B"}));
  const otherMember=checked(await admin.from("memberships").insert({user_id:account.id,group_id:group.group_id}).select("id").single());
  try {
    await page.goto("/groupe/reglages");await page.getByText("Mon profil",{exact:true}).click();
    await expect(page.getByLabel("Votre nom dans le groupe",{exact:true})).toHaveValue("Recette compte A");
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(page).toHaveURL(/\/accueil$/);await page.waitForLoadState("networkidle");
    const values=new Map<string,string>();
    const other=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...values].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(({name,value})=>values.set(name,value))}});
    const link=checked(await admin.auth.admin.generateLink({type:"magiclink",email:account.email!}));
    checked(await other.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"}));
    await context.clearCookies();await context.addCookies([...values].map(([name,value])=>({name,value,domain:"127.0.0.1",path:"/"})));
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Groupe",exact:true}).click();
    await expect(page).toHaveURL(/\/groupe$/);await expect(page.getByRole("link",{name:/Gérer le groupe/})).toHaveCount(0);
    await page.getByRole("link",{name:/Mes réglages Notifications et profil/}).click();
    await page.getByText("Mon profil",{exact:true}).click();
    await expect(page.getByLabel("Votre nom dans le groupe",{exact:true})).toHaveValue("Recette compte B");
    const persisted=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
    expect(persisted).not.toContain("Recette compte A");
  } finally {
    checked(await admin.from("memberships").delete().eq("id",otherMember.id));
    checked(await admin.from("profiles").delete().eq("user_id",account.id));
    checked(await admin.auth.admin.deleteUser(account.id));
  }
});

test("la déconnexion empêche le retour à une page privée préchargée",async({page})=>{
  await page.goto("/accueil");await page.waitForLoadState("networkidle");
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Groupe",exact:true}).click();
  await expect(page).toHaveURL(/\/groupe$/);
  await page.getByRole("link",{name:/Mes réglages Notifications et profil/}).click();
  await page.getByRole("button",{name:"Me déconnecter",exact:true}).click();await expect(page).toHaveURL(/\/connexion$/);
  await page.goBack();await expect(page).toHaveURL(/\/connexion$/);await expect(page.getByRole("navigation",{name:"Navigation principale"})).toHaveCount(0);
});

test("Actualiser récupère les changements d’un autre membre",async({page,authCookies})=>{
  const {admin,user}=await actor(authCookies);
  await page.goto("/groupe");await page.waitForLoadState("networkidle");
  checked(await admin.from("profiles").update({display_name:"Nom actualisé depuis une autre requête"}).eq("user_id",user.id));
  await page.getByRole("button",{name:"Actualiser les informations du groupe",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Nom actualisé depuis une autre requête",exact:true})).toBeVisible();
});
