import {test,expect} from "@playwright/test";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {clients,checked} from "../../scripts/local-supabase.mjs";
import {addDays,localInstant,monday,today} from "../../src/lib/time/paris";

test("proposer, voter à deux comptes, confirmer puis répondre et libérer un créneau",async({page,browser},info)=>{
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  const {admin,config}=clients();const users:string[]=[],members:string[]=[];
  const group=checked(await admin.from("groups").select("id").single());
  const week=addDays(monday(today(new Date().toISOString())),7);
  const names=[`Organisateur ${randomUUID().slice(0,6)}`,`Invité ${randomUUID().slice(0,6)}`];
  const title=`Soirée J5 ${randomUUID().slice(0,8)}`;
  const context=await browser.newContext({baseURL:"http://127.0.0.1:3100"});const other=await context.newPage();
  other.setDefaultTimeout(10_000);
  try{
    for(let i=0;i<2;i++){
      const email=`session-ui-${randomUUID()}@example.test`;
      const user=checked(await admin.auth.admin.createUser({email,email_confirm:true})).user;users.push(user.id);
      checked(await admin.from("profiles").insert({user_id:user.id,display_name:names[i]}));
      members.push(checked(await admin.from("memberships").insert({user_id:user.id,group_id:group.id}).select("id").single()).id);
      const values=new Map<string,string>();
      const actor=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...values].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(({name,value})=>values.set(name,value))}});
      const link=checked(await admin.auth.admin.generateLink({type:"magiclink",email}));checked(await actor.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"}));
      await (i===0?page:other).context().addCookies([...values].map(([name,value])=>({name,value,domain:"127.0.0.1",path:"/"})));
      checked(await actor.rpc("save_availability",{changes:[{local_date:week,status:"available",mode:"detailed",expected_revision:null,intervals:[{starts_at:localInstant(week,"20:00"),ends_at:localInstant(week,"21:00")}]}]}));
    }
    await page.goto("/sessions");await page.getByText("Proposer une session",{exact:true}).click();
    const form=page.getByRole("button",{name:"Enregistrer le brouillon",exact:true}).locator("..");
    await form.getByLabel("Titre de la session",{exact:true}).fill(title);
    for(let i=1;i<=2;i++){const day=addDays(week,i-1);await form.getByLabel(`Début du créneau ${i}`,{exact:true}).fill(`${day}T20:00`);await form.getByLabel(`Fin du créneau ${i}`,{exact:true}).fill(`${day}T21:00`);}
    await form.getByRole("button",{name:"Enregistrer le brouillon",exact:true}).click();
    const card=page.getByRole("article",{name:title,exact:true});const otherCard=other.getByRole("article",{name:title,exact:true});
    await expect(card.getByText("Brouillon",{exact:true})).toBeVisible();
    await other.goto("/sessions");await expect(otherCard).toHaveCount(0);
    await card.getByRole("button",{name:"Publier la proposition"}).click();await expect(card.getByText("Vote ouvert",{exact:true})).toBeVisible();
    await other.reload();await expect(otherCard.getByText("Vous n’avez pas encore répondu.",{exact:true})).toBeVisible();
    for(const check of await otherCard.getByRole("checkbox").all())await check.check();
    await otherCard.getByRole("button",{name:"Enregistrer mon vote"}).click();await expect(otherCard.getByText("Votre bulletin est enregistré ; vous pouvez le modifier.",{exact:true})).toBeVisible();
    for(const check of await otherCard.getByRole("checkbox").all())await check.uncheck();
    await otherCard.getByRole("button",{name:"Enregistrer mon vote"}).click();await expect(otherCard.getByText("Votre réponse : aucun créneau ne me convient.",{exact:true})).toBeVisible();
    await otherCard.getByRole("checkbox").first().check();await otherCard.getByRole("button",{name:"Enregistrer mon vote"}).click();await expect(otherCard.getByText("Votre bulletin est enregistré ; vous pouvez le modifier.",{exact:true})).toBeVisible();
    await page.reload();await card.getByText("Organiser cette session",{exact:true}).click();await card.getByRole("button",{name:"Clore le vote maintenant"}).click();await expect(card.getByText("Vote clos",{exact:true})).toBeVisible();
    await card.getByText("Organiser cette session",{exact:true}).click();await card.getByRole("button",{name:"Confirmer ce créneau"}).click();await expect(card.getByText("Confirmée",{exact:true})).toBeVisible();
    await expect(card.getByText("Vous n’avez pas encore confirmé votre participation.",{exact:true})).toBeVisible();
    await other.reload();await expect(otherCard.getByText("Vous n’avez pas encore confirmé votre participation.",{exact:true})).toBeVisible();
    await test.step("RSVP du second compte",async()=>{await otherCard.getByRole("combobox",{name:"Ma participation",exact:true}).selectOption("attending");await otherCard.getByRole("button",{name:"Enregistrer ma participation"}).click();await expect(otherCard.getByText("Votre réponse : je participe.",{exact:true})).toBeVisible();});
    await card.getByRole("combobox",{name:"Ma participation",exact:true}).selectOption("attending");await card.getByRole("button",{name:"Enregistrer ma participation"}).click();await expect(card.getByText("Votre réponse : je participe.",{exact:true})).toBeVisible();
    await card.screenshot({path:info.outputPath("session-confirmee.png")});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // L’accueil est collectif : un autre scénario parallèle peut proposer un créneau aussi tôt.
    await page.goto("/accueil");const next=page.getByRole("region",{name:"Prochaine session"});await expect(next).toBeVisible();await expect(next).toContainText("Paris");await expect(next.getByRole("link")).toHaveAttribute("href",/^\/sessions\?session=[\da-f-]{36}#session-[\da-f-]{36}$/);
    await page.goto(`/dispos?semaine=${week}`);const search=page.getByRole("heading",{name:"Trouver un créneau commun",exact:true}).locator("..");
    await search.getByText("Affiner la recherche",{exact:true}).click();
    for(const check of await search.getByRole("checkbox").all())await check.uncheck();for(const name of names)await search.getByLabel(name,{exact:true}).check();
    await search.getByRole("button",{name:"Rechercher des créneaux"}).click();await expect(search.getByText("Aucun créneau commun",{exact:false})).toBeVisible();
    await page.goto("/sessions");await card.getByText("Annuler cette session",{exact:true}).click();await card.getByRole("button",{name:"Annuler définitivement"}).click();await page.getByText(/Sessions passées et annulées ·/).click();await expect(card.getByText("Annulée",{exact:true})).toBeVisible();
    await page.goto(`/dispos?semaine=${week}`);await search.getByText("Affiner la recherche",{exact:true}).click();for(const check of await search.getByRole("checkbox").all())await check.uncheck();for(const name of names)await search.getByLabel(name,{exact:true}).check();
    await search.getByRole("button",{name:"Rechercher des créneaux"}).click();await expect(search.getByRole("listitem")).toHaveCount(1);
  }finally{
    await context.close().catch(()=>{});if(members.length){const sessions=checked(await admin.from("sessions").select("id").in("created_by",members));if(sessions.length){checked(await admin.from("sessions").delete().in("id",sessions.map(s=>s.id)));const ids=sessions.map(s=>`'${s.id}'`).join(",");execFileSync("docker",["exec","supabase_db_OnJoueQuand","psql","-U","postgres","-d","postgres","-Atc",`delete from private.notification_outbox where resource_id in (${ids}); delete from private.audit_events where resource_id in (${ids})`],{stdio:"pipe"});}
      checked(await admin.from("availability_days").delete().in("membership_id",members));checked(await admin.from("memberships").delete().in("id",members));checked(await admin.from("profiles").delete().in("user_id",users));}
    for(const id of users)checked(await admin.auth.admin.deleteUser(id));
  }
});
