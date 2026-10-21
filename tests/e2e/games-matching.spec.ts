import { test,expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { clients,checked } from "../../scripts/local-supabase.mjs";
import { addDays,localInstant,monday,today } from "../../src/lib/time/paris";
test("créer un jeu, gérer ses favoris et trouver un vrai créneau commun",async({page},testInfo)=>{
  const {admin,config}=clients(); const users:string[]=[]; const ids:string[]=[]; const games:string[]=[];
  const group=checked(await admin.from("groups").select("id").single());
  const week=addDays(monday(today(new Date().toISOString())),7);
  const names=[`Créateur ${randomUUID().slice(0,8)}`,`Partenaire ${randomUUID().slice(0,8)}`];
  let email="";
  try {
    for(let i=0;i<2;i++) {
      const address=`jeux-ui-${randomUUID()}@example.test`; if(i===0) email=address;
      const user=checked(await admin.auth.admin.createUser({email:address,email_confirm:true})).user; users.push(user.id);
      checked(await admin.from("profiles").insert({user_id:user.id,display_name:names[i]}));
      ids.push(checked(await admin.from("memberships").insert({group_id:group.id,user_id:user.id}).select("id").single()).id);
    }
    const cookies=new Map<string,string>();
    const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>cookies.set(name,value))}});
    const link=checked(await admin.auth.admin.generateLink({type:"magiclink",email}));
    checked(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"}));
    await page.context().addCookies([...cookies].map(([name,value])=>({name,value,domain:"127.0.0.1",path:"/"})));
    // Les réponses passent par la RPC réelle avec le JWT propre à chaque membre.
    for(let i=0;i<2;i++) {
      let actor=client;
      if(i===1) {
        const account=checked(await admin.auth.admin.getUserById(users[i]!));
        const magic=checked(await admin.auth.admin.generateLink({type:"magiclink",email:account.user.email!}));
        actor=createServerClient(config.url,config.key,{cookies:{getAll:()=>[],setAll:()=>{}}});
        checked(await actor.auth.verifyOtp({token_hash:magic.properties.hashed_token,type:"email"}));
      }
      checked(await actor.rpc("save_availability",{changes:[{local_date:week,status:"available",mode:"detailed",expected_revision:null,intervals:[{starts_at:localInstant(week,i===0?"20:00":"21:00"),ends_at:localInstant(week,"23:00")}]}]}));
    }
    await page.goto("/groupe/jeux");
    await page.getByText("Ajouter un jeu personnalisé",{exact:true}).click();
    const name=`Jeu J4 ${randomUUID().slice(0,8)}`;
    await page.getByLabel("Nom du jeu",{exact:true}).fill(name);
    await page.getByLabel("Description du jeu",{exact:true}).fill("Un jeu coopératif pour le groupe.");
    await page.getByRole("button",{name:"Ajouter ce jeu",exact:true}).click();
    const card=page.getByRole("article").filter({has:page.getByRole("heading",{name,exact:true})});
    await expect(card).toBeVisible();
    const game=checked(await client.from("games").select("id").eq("name",name).single()); games.push(game.id);
    await card.getByRole("button",{name:"Ajouter à mes favoris",exact:true}).click();
    await expect(card.getByRole("button",{name:"Retirer de mes favoris"})).toHaveAttribute("aria-pressed","true");
    await card.getByText("Modifier ou archiver ce jeu",{exact:true}).click();
    await card.getByLabel("Nouveau nom").fill(`${name} modifié`);
    await card.getByRole("button",{name:"Enregistrer le jeu"}).click();
    await expect(card).toHaveCount(0);
    const renamed=page.getByRole("article").filter({has:page.getByRole("heading",{name:`${name} modifié`,exact:true})});
    await expect(renamed).toBeVisible();
    await renamed.screenshot({path:testInfo.outputPath("catalogue.png")});

    await page.goto(`/dispos?semaine=${week}`);
    const search=page.getByRole("heading",{name:"Trouver un créneau commun",exact:true}).locator("..");
    await search.getByText("Affiner la recherche",{exact:true}).click();
    const checks=search.getByRole("checkbox");
    for(const check of await checks.all()) await check.uncheck();
    await search.getByLabel(names[0]!,{exact:true}).check(); await search.getByLabel(names[1]!,{exact:true}).check();
    await search.getByLabel("Jeu facultatif").selectOption(game.id);
    await search.getByRole("button",{name:"Rechercher des créneaux"}).click();
    await expect(search.getByRole("listitem")).toHaveCount(5);
    await expect(search.getByRole("listitem").first()).toContainText("21:00–22:00");
    await expect(search.getByRole("listitem").first()).toContainText("2 joueurs disponibles sur toute la durée · 1 favori");
    await expect(search.getByLabel("Jeu facultatif")).toHaveValue(game.id);
    await expect(search.getByRole("checkbox",{checked:true})).toHaveCount(2);
    await page.getByRole("heading",{name:"Trouver un créneau commun",exact:true}).scrollIntoViewIfNeeded();
    await search.screenshot({path:testInfo.outputPath("suggestions.png")});
    await search.getByLabel("Durée en minutes").fill("180");
    await search.getByRole("button",{name:"Rechercher des créneaux"}).click();
    await expect(search.getByText("Aucun créneau commun",{exact:false})).toBeVisible();
    await expect(search.getByLabel("Durée en minutes")).toHaveValue("180");
    await page.goto("/groupe/jeux");
    await renamed.getByText("Modifier ou archiver ce jeu",{exact:true}).click();
    await renamed.getByRole("button",{name:"Archiver ce jeu"}).click();
    await expect(renamed).toHaveCount(0);
    await page.getByLabel("Afficher aussi les jeux archivés").check();
    await expect(renamed.getByText("Archivé · historique conservé")).toBeVisible();
    await renamed.getByRole("button",{name:"Retirer de mes favoris"}).click();
    await expect(renamed.getByRole("button",{name:"Ajouter à mes favoris"})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {
    // Nettoyage limité aux identités et ressources synthétiques de ce parcours.
    if(ids.length) {
      const created=checked(await admin.from("games").select("id").in("created_by",ids));
      const gameIds=[...new Set([...games,...created.map(g=>g.id)])];
      if(gameIds.length) {checked(await admin.from("game_favorites").delete().in("game_id",gameIds));checked(await admin.from("games").delete().in("id",gameIds));}
      checked(await admin.from("availability_days").delete().in("membership_id",ids));
      checked(await admin.from("memberships").delete().in("id",ids));
    }
    if(users.length) checked(await admin.from("profiles").delete().in("user_id",users));
    for(const id of users) checked(await admin.auth.admin.deleteUser(id));
  }
});
