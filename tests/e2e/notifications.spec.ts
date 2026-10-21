import {test,expect} from "@playwright/test";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {clients,checked,identity} from "../../scripts/local-supabase.mjs";
test("notifications privées, préférences et job HTTP authentifié",async({page,request},info)=>{
  const {admin,anonymous,config}=clients();const people=[];const members:string[]=[];let session="";
  const group=checked(await admin.from("groups").select("id").single());
  try{
    for(const name of ["Auteur","Destinataire"]){const p=await identity(admin,anonymous,`notifications-ui-${name.toLowerCase()}`);people.push(p);checked(await admin.from("profiles").insert({user_id:p.user.id,display_name:`Recette ${name}`}));members.push(checked(await admin.from("memberships").insert({group_id:group.id,user_id:p.user.id}).select("id").single()).id);}
    const values=new Map<string,string>();const actor=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...values].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(({name,value})=>values.set(name,value))}});
    const link=checked(await admin.auth.admin.generateLink({type:"magiclink",email:people[1]!.email}));checked(await actor.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"email"}));await page.context().addCookies([...values].map(([name,value])=>({name,value,domain:"127.0.0.1",path:"/"})));
    const start=Math.ceil((Date.now()+10*86400000)/900000)*900000;
    session=checked(await people[0]!.client.rpc("create_session",{session_title:"Soirée notification",session_description:"",selected_game:null,player_threshold:2,candidate_slots:[0,1].map(n=>({starts_at:new Date(start+n*86400000).toISOString(),ends_at:new Date(start+n*86400000+3600000).toISOString()})),deadline:null,request_id:randomUUID()}));
    checked(await people[0]!.client.rpc("session_command",{target_id:session,command:"publish",expected_revision:1,payload:{}}));
    expect((await request.post("/api/internal/jobs")).status()).toBe(401);expect((await request.post("/api/internal/jobs",{headers:{Authorization:"Bearer incorrect"}})).status()).toBe(401);
    const secret=process.env.JOBS_SECRET;if(!secret)throw new Error("Le wrapper de recette doit fournir le secret de job.");
    for(let i=0;i<2;i++)expect((await request.post("/api/internal/jobs",{headers:{Authorization:`Bearer ${secret}`}})).status()).toBe(200);
    await expect.poll(async()=>{await request.post("/api/internal/jobs",{headers:{Authorization:`Bearer ${secret}`}});return checked(await actor.from("notifications").select("id").eq("resource_id",session)).length;}).toBe(1);
    await page.goto("/accueil");const inbox=page.getByRole("region",{name:"Vos notifications",exact:true});const note=inbox.getByRole("listitem").filter({has:page.locator(`a[href="/sessions?session=${session}#session-${session}"]`)});await expect(note).toHaveCount(1);
    await note.getByRole("button",{name:"Marquer comme lue"}).click();await expect(note.getByText("Lue",{exact:true})).toBeVisible();await expect(note.getByRole("button",{name:"Marquer comme lue"})).toHaveCount(0);
    await inbox.screenshot({path:info.outputPath("notifications.png")});
    await note.getByRole("link",{name:"Consulter",exact:true}).click();await expect(page.locator(`#session-${session}`)).toBeVisible();
    await page.goto("/groupe");const settings=page.getByRole("region",{name:"Mes notifications",exact:true});await settings.getByRole("checkbox",{name:"Rappels de disponibilités le dimanche et le lundi"}).uncheck();await settings.getByRole("button",{name:"Enregistrer mes préférences"}).click();await expect(settings.getByRole("status").filter({hasText:"Préférences enregistrées."})).toBeVisible();await expect(settings.getByRole("checkbox",{name:"Rappels de disponibilités le dimanche et le lundi"})).not.toBeChecked();
    await page.reload();await expect(settings.getByRole("checkbox",{name:"Rappels de disponibilités le dimanche et le lundi"})).not.toBeChecked();
    await settings.getByRole("button",{name:"Activer sur cet appareil"}).click();await expect(settings.getByRole("status").filter({hasText:/Le Push n’est pas encore configuré|ne prend pas en charge/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // Le worker ne met jamais les requêtes privées en cache.
    const sw=await request.get("/sw.js");expect(sw.status()).toBe(200);expect(sw.headers()["cache-control"]).toContain("no-store");expect(await sw.text()).not.toContain("cache.put(request");
  }finally{
    if(session){checked(await admin.from("sessions").delete().eq("id",session));execFileSync("docker",["exec","supabase_db_OnJoueQuand","psql","-U","postgres","-d","postgres","-Atc",`delete from private.notification_outbox where resource_id='${session}';delete from private.audit_events where resource_id='${session}'`],{stdio:"pipe"});}
    if(members.length){checked(await admin.from("notifications").delete().in("membership_id",members));checked(await admin.from("memberships").delete().in("id",members));checked(await admin.from("profiles").delete().in("user_id",people.map(p=>p.user.id)));}
    for(const p of people)checked(await admin.auth.admin.deleteUser(p.user.id));
  }
});
