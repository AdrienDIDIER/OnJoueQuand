import {expect} from "@playwright/test";
import {test} from "../e2e/fixtures";
import {clients,checked} from "../../scripts/local-supabase.mjs";
import {createServerClient} from "@supabase/ssr";

test.use({serviceWorkers:"block"});
test("mesurer six réponses rapides avec 120 ms de délai réseau",async({page,authCookies})=>{
  const {admin,config}=clients();
  const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>authCookies,setAll:()=>{}}});
  const {user}=checked(await client.auth.getUser());
  const member=checked(await client.from("memberships").select("id").eq("user_id",user!.id).single());
  const responses:{ms:number;type:string;resources:number;serverTiming?:string}[]=[];
  await page.route(url=>url.pathname.startsWith("/api/")||url.pathname==="/dispos",async route=>{
    if(route.request().method()==="POST")await new Promise(resolve=>setTimeout(resolve,120));
    await route.continue();
  });
  try{
  await page.goto("/dispos");await page.waitForLoadState("networkidle");
  for(let i=0;i<6;i++){
    const row=page.locator(".day-editor").nth(Math.floor(i/2));
    const button=row.getByRole("button",{name:i%2?"Indispo":"Dispo 20:00–23:00",exact:true});
    const responsePromise=page.waitForResponse(response=>response.request().method()==="POST");
    const count=await page.evaluate(()=>performance.getEntriesByType("resource").length);
    const start=performance.now();
    await button.click();const response=await responsePromise;
    await expect(button).toBeEnabled();await expect(button).toHaveAttribute("aria-pressed","true");
    responses.push({ms:Math.round(performance.now()-start),type:response.headers()["content-type"]??"",resources:await page.evaluate(()=>performance.getEntriesByType("resource").length)-count,serverTiming:response.headers()["server-timing"]});
    await page.waitForLoadState("networkidle");
  }
  const times=responses.map(r=>r.ms).sort((a,b)=>a-b);
  console.log(JSON.stringify({medianMs:(times[2]!+times[3]!)/2,responses}));
  }finally{checked(await admin.from("availability_days").delete().eq("membership_id",member.id));}
});
