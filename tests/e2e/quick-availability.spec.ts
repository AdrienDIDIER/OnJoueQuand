import {expect} from "@playwright/test";
import {test} from "./fixtures";
import {createServerClient} from "@supabase/ssr";
import {clients,checked} from "../../scripts/local-supabase.mjs";
import {today} from "../../src/lib/time/paris";
import {request as httpRequest} from "node:http";

test.use({serviceWorkers:"block"});
const origin="http://127.0.0.1:3100";
const headers={Origin:origin};
const input=()=>({date:today(new Date().toISOString()),revision:null,status:"available",quickStart:"20:00",quickEnd:"23:00"});
async function actor(cookies:{name:string;value:string}[]){
  const {admin,config}=clients();
  const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>cookies,setAll:()=>{}}});
  const {user}=checked(await client.auth.getUser());
  const member=checked(await client.from("memberships").select("id").eq("user_id",user!.id).single());
  return{admin,client,member,user:user!};
}

test("un jour lent ne bloque ni les autres réponses ni les onglets",async({page,authCookies})=>{
  const {admin,member}=await actor(authCookies);
  let resume!:()=>void;const gate=new Promise<void>(resolve=>{resume=resolve;});
  try{
    await page.goto("/dispos");await page.waitForLoadState("networkidle");
    const firstDate=await page.locator(".day-editor").first().locator('input[name="date"]').inputValue();
    await page.route("**/api/availability/quick",async route=>{if(route.request().postDataJSON().date===firstDate)await gate;await route.continue().catch(()=>{});});
    const firstResponse=page.waitForResponse(response=>response.url().endsWith("/api/availability/quick")&&response.request().postDataJSON().date===firstDate);
    try{
      await page.locator(".day-editor").first().getByRole("button",{name:"Dispo 20:00–23:00",exact:true}).click();
      await page.locator(".day-editor").nth(1).getByRole("button",{name:"Dispo 20:00–23:00",exact:true}).click();
      await expect(page.getByRole("heading",{name:"Mes réponses · 1/7",exact:true})).toBeVisible();
      await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Accueil",exact:true}).click();
      await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toContainText("1/7");
    }finally{resume();await firstResponse;}
    await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toContainText("2/7");
  }finally{resume();checked(await admin.from("availability_days").delete().eq("membership_id",member.id));}
});

test("réponse JSON : concurrence, révisions et identité serveur",async({page,authCookies})=>{
  const {admin,client,member}=await actor(authCookies);
  const access=await (await page.request.get("/api/session-status")).json();
  const mutationHeaders={...headers,"X-OJQ-Context":access.accessKey};
  try{
    const results=await Promise.all([0,1].map(()=>page.request.post("/api/availability/quick",{headers:mutationHeaders,data:input()})));
    expect(results.map(r=>r.status()).sort()).toEqual([200,409]);
    const success=await results.find(r=>r.status()===200)!.json();
    const stored=checked(await client.from("availability_days").select("status,mode,revision,availability_intervals(starts_at,ends_at)").eq("membership_id",member.id).single());
    expect(success.day.revision).toBe(stored.revision);expect(success.day.status).toBe(stored.status);
    const instants=(intervals:{starts_at:string;ends_at:string}[])=>intervals.map(i=>[Date.parse(i.starts_at),Date.parse(i.ends_at)]);
    expect(instants(success.day.intervals)).toEqual(instants(stored.availability_intervals));
    expect(results[0]!.headers()["cache-control"]).toContain("no-store");
    const staleContext=await page.request.post("/api/availability/quick",{headers:{...headers,"X-OJQ-Context":"ancien-contexte"},data:{...input(),revision:stored.revision}});
    expect(staleContext.status()).toBe(409);expect((await staleContext.json()).code).toBe("context_changed");
    expect((await page.request.post("/api/availability/quick",{headers:mutationHeaders,data:{...input(),revision:stored.revision,membership_id:crypto.randomUUID()}})).status()).toBe(409);
    expect((await page.request.post("/api/availability/quick",{headers:mutationHeaders,data:{...input(),revision:stored.revision,quickStart:"19:00"}})).status()).toBe(409);
    const changed=await page.request.post("/api/availability/quick",{headers:mutationHeaders,data:{...input(),revision:stored.revision,status:"unavailable"}});
    expect(changed.status()).toBe(200);expect((await changed.json()).day.revision).toBe(stored.revision+1);
  }finally{checked(await admin.from("availability_days").delete().eq("membership_id",member.id));}
});

test("origine, format, accès anonyme et révocation sont contrôlés sur l’API",async({page,request,authCookies})=>{
  expect((await request.post("/api/availability/quick",{headers,data:input(),maxRedirects:0})).status()).toBe(307);
  expect((await page.request.post("/api/availability/quick",{headers:{Origin:"https://externe.example"},data:input()})).status()).toBe(403);
  expect((await page.request.post("/api/availability/quick",{headers:{...headers,"Content-Type":"text/plain"},data:"{}"})).status()).toBe(415);
  expect((await page.request.post("/api/availability/quick",{headers:{...headers,"Content-Type":"application/json"},data:Buffer.from("{")})).status()).toBe(400);
  expect((await page.request.post("/api/availability/quick",{headers,data:{...input(),padding:"x".repeat(5000)}})).status()).toBe(413);
  const streamedStatus=await new Promise<number>((resolve,reject)=>{
    const stream=httpRequest(`${origin}/api/availability/quick`,{method:"POST",headers:{...headers,"Content-Type":"application/json","Transfer-Encoding":"chunked"}},response=>{response.resume();resolve(response.statusCode??0);});
    stream.on("error",reject);stream.write("{");stream.end("x".repeat(5000));
  });
  expect(streamedStatus).toBe(413);
  const {admin,user}=await actor(authCookies);
  checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",user.id));
  expect((await page.request.post("/api/availability/quick",{headers,data:input(),maxRedirects:0})).status()).toBe(307);
});

test("une réponse rapide met à jour la semaine, l’accueil et le calendrier sans rendu global",async({page,authCookies})=>{
  const {admin,member}=await actor(authCookies);
  try{
    await page.goto("/dispos/groupe");await page.waitForLoadState("networkidle");
    const nav=page.getByRole("navigation",{name:"Navigation principale"});
    await nav.getByRole("link",{name:"Dispos",exact:true}).click();await page.waitForLoadState("networkidle");
    let renders=0;
    page.on("request",request=>{if(new URL(request.url()).searchParams.has("_rsc")&&!request.headers()["next-router-prefetch"])renders++;});
    const response=page.waitForResponse(r=>r.url().endsWith("/api/availability/quick"));
    await page.locator(".day-editor").first().getByRole("button",{name:"Dispo 20:00–23:00",exact:true}).click();
    const result=await response;expect(result.headers()["content-type"]).toContain("application/json");
    expect((await result.body()).length).toBeLessThan(1024);
    await expect(page.getByRole("heading",{name:"Mes réponses · 1/7",exact:true})).toBeVisible();
    await nav.getByRole("link",{name:"Accueil",exact:true}).click();
    await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toContainText("1/7");
    expect(renders).toBe(0);
    await nav.getByRole("link",{name:"Dispos",exact:true}).click();
    await page.getByRole("link",{name:"Le groupe",exact:true}).click();
    await expect(page.locator(".availability-table tbody tr").filter({hasText:"(vous)"}).locator("td").first()).toHaveAttribute("data-status","available");
  }finally{checked(await admin.from("availability_days").delete().eq("membership_id",member.id));}
});

test("un refus annule l’affichage optimiste sans annoncer un enregistrement",async({page})=>{
  await page.goto("/dispos");await page.waitForLoadState("networkidle");
  let resume!:()=>void;const gate=new Promise<void>(resolve=>{resume=resolve;});
  await page.route("**/api/availability/quick",async route=>{await gate;await route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({message:"Disponibilités modifiées. Rechargez la page avant de continuer."})});});
  const button=page.locator(".day-editor").first().getByRole("button",{name:"Dispo 20:00–23:00",exact:true});
  try{await button.click();await expect(button).toHaveAttribute("aria-pressed","true");await expect(button).toBeDisabled();await expect(page.getByRole("heading",{name:"Mes réponses · 0/7",exact:true})).toBeVisible();}
  finally{resume();}
  await expect(button).toBeEnabled();await expect(button).toHaveAttribute("aria-pressed","false");
  await expect(page.getByRole("status").filter({hasText:"Disponibilités modifiées"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Mes réponses · 0/7",exact:true})).toBeVisible();
});
