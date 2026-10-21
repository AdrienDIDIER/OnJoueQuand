import {expect} from "@playwright/test";
import {test} from "../e2e/fixtures";

// Recette opt-in, sur une stack synthétique dédiée. Ne journalise que des durées et compteurs.
test.use({serviceWorkers:"block"});
test("mesurer douze déplacements avec 120 ms de délai réseau",async({page})=>{
  const observations:{route:string;ms:number;documents:number;checks:number}[]=[];
  let documents=0,checks=0;
  await page.route(url=>url.searchParams.has("_rsc")||url.pathname==="/api/session-status",async route=>{
    await new Promise(resolve=>setTimeout(resolve,120));await route.continue();
  });
  page.on("request",request=>{
    const url=new URL(request.url());
    if(url.searchParams.has("_rsc")&&!request.headers()["next-router-prefetch"])documents++;
    if(url.pathname==="/api/session-status")checks++;
  });
  await page.goto("/accueil");
  await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toBeVisible();
  await page.waitForLoadState("networkidle");
  const tabs=[{name:"Dispos",path:"/dispos"},{name:"Sessions",path:"/sessions"},{name:"Groupe",path:"/groupe"},{name:"Accueil",path:"/accueil"}];
  for(let cycle=0;cycle<3;cycle++)for(const tab of tabs){
    const beforeDocs=documents,beforeChecks=checks,start=Date.now();
    await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:tab.name,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    if(tab.name==="Accueil")await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toBeVisible();
    else if(tab.name==="Dispos")await expect(page.locator(".day-editor")).toHaveCount(7);
    else if(tab.name==="Sessions")await expect(page.getByRole("button",{name:"Proposer une session",exact:true})).toBeVisible();
    else await expect(page.getByRole("heading",{name:"Les membres",exact:true})).toBeVisible();
    observations.push({route:tab.path,ms:Date.now()-start,documents:documents-beforeDocs,checks:checks-beforeChecks});
    await page.waitForLoadState("networkidle");
  }
  const durations=observations.map(row=>row.ms).sort((a,b)=>a-b);
  const lower=durations[5],upper=durations[6];
  if(lower===undefined||upper===undefined)throw new Error("Mesures insuffisantes pour calculer la médiane.");
  console.log(JSON.stringify({medianMs:(lower+upper)/2,observations}));
});
