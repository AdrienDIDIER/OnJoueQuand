import {test,expect} from "@playwright/test";

test("premier démarrage : invitation, report mémorisé et navigation libre",async({page})=>{
  await page.goto("/connexion");
  const invitation=page.getByRole("dialog",{name:"Votre groupe, à portée de main.",exact:true});
  await expect(invitation).toBeVisible();
  await invitation.getByRole("button",{name:"Plus tard",exact:true}).click();
  await expect(invitation).not.toBeVisible();
  expect(Number(await page.evaluate(()=>localStorage.getItem("ojq-install-later-until")))).toBeGreaterThan(Date.now()+6*86400000);
  await page.reload();
  // Dépasser le délai d'ouverture pour vérifier réellement son absence après report.
  await page.waitForTimeout(1100);await expect(invitation).not.toBeVisible();
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

test("le bouton utilise l’installation native uniquement après un clic",async({page})=>{
  await page.goto("/connexion");
  const invitation=page.getByRole("dialog",{name:"Votre groupe, à portée de main.",exact:true});
  await expect(invitation).toBeVisible();
  await page.evaluate(()=>{
    document.documentElement.dataset.promptCount="0";
    const event=new Event("beforeinstallprompt",{cancelable:true});
    Object.defineProperties(event,{prompt:{value:async()=>{document.documentElement.dataset.promptCount=String(Number(document.documentElement.dataset.promptCount)+1);}},userChoice:{value:Promise.resolve({outcome:"accepted"})}});
    window.dispatchEvent(event);
  });
  await expect(page.locator("html")).toHaveAttribute("data-prompt-count","0");
  await invitation.getByRole("button",{name:"Installer l’application",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-prompt-count","1");
  await expect(invitation).not.toBeVisible();
});

test("sur iPhone, les étapes remplacent un faux bouton automatique",async({page},info)=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,"userAgent",{get:()=>"Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1"});});
  await page.goto("/connexion");
  const invitation=page.getByRole("dialog",{name:"Votre groupe, à portée de main.",exact:true});
  await expect(invitation).toBeVisible();
  await expect(invitation.getByText("Partager",{exact:true})).toBeVisible();
  await expect(invitation.getByText("Sur l’écran d’accueil",{exact:true})).toBeVisible();
  await expect(invitation.getByRole("button",{name:"Installer l’application",exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath("installation-iphone.png")});
  await page.keyboard.press("Escape");await expect(invitation).not.toBeVisible();
});

test("en mode application installée, aucune invitation au démarrage",async({page})=>{
  await page.addInitScript(()=>{
    const original=window.matchMedia.bind(window);
    window.matchMedia=query=>{const result=original(query);if(query==="(display-mode: standalone)")Object.defineProperty(result,"matches",{value:true});return result;};
  });
  await page.goto("/connexion");await page.waitForTimeout(1100);
  await expect(page.getByRole("dialog",{name:"Votre groupe, à portée de main.",exact:true})).not.toBeVisible();
});

test("l’installation détectée ferme l’invitation sans recharger la page",async({page})=>{
  await page.goto("/connexion");
  const invitation=page.getByRole("dialog",{name:"Votre groupe, à portée de main.",exact:true});
  await expect(invitation).toBeVisible();
  await page.evaluate(()=>{document.documentElement.dataset.kept="oui";window.dispatchEvent(new Event("appinstalled"));});
  await expect(invitation).not.toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-kept","oui");
});
