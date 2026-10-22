import {expect} from "@playwright/test";
import {test} from "./fixtures";

test("la navigation touche le bas dès la première ouverture et après redimensionnement",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/accueil");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content",/viewport-fit=auto/);
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content","black");
  await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toBeVisible();
  const navigation=page.getByRole("navigation",{name:"Navigation principale"});
  const assertDock=async()=>{
    await expect(navigation).toBeVisible();
    await expect.poll(()=>navigation.evaluate(element=>{
      const bounds=element.getBoundingClientRect();
      return Math.abs(bounds.bottom-window.innerHeight);
    })).toBeLessThanOrEqual(1);
    const paint=await navigation.evaluate(element=>({
      bar:getComputedStyle(element).backgroundColor,
      canvas:getComputedStyle(document.documentElement).backgroundColor,
    }));
    expect(paint.bar).toBe("rgb(34, 36, 29)");
    expect(paint.canvas).toBe(paint.bar);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const name of ["Accueil","Dispos","Soirées","Groupe"]){
      const box=await navigation.getByRole("link",{name,exact:true}).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  };
  // Aucun changement d’onglet préalable : vérifier aussi une hauteur qui se stabilise.
  await assertDock();
  await page.setViewportSize({width:390,height:780});await assertDock();
  await page.setViewportSize({width:740,height:390});await assertDock();
  await page.setViewportSize({width:390,height:844});await assertDock();
  // Le calage ne doit pas dépendre d’un premier geste de défilement.
  const initial=await navigation.boundingBox();
  await page.evaluate(()=>{
    const spacer=document.createElement("div");
    spacer.id="launch-scroll-fixture";spacer.style.height="1800px";
    document.querySelector("#contenu")!.append(spacer);
    window.scrollTo({top:300,behavior:"instant"});
  });
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await assertDock();
  expect((await navigation.boundingBox())!.y).toBeCloseTo(initial!.y,0);
  await page.evaluate(()=>{
    document.querySelector("#launch-scroll-fixture")!.remove();
    window.scrollTo({top:0,behavior:"instant"});
  });
  await assertDock();
  await navigation.getByRole("link",{name:"Dispos",exact:true}).click();
  await expect(page).toHaveURL(/\/dispos$/);
  await expect(page.getByRole("heading",{name:/Mes réponses/})).toBeVisible();
  await assertDock();
});

test("le diagnostic garde le lancement, reste borné et se vide au rechargement",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/accueil");
  await expect(page.getByRole("link",{name:/Vos soirées cette semaine/})).toBeVisible();
  await page.getByRole("navigation",{name:"Navigation principale"}).getByRole("link",{name:"Groupe",exact:true}).click();
  await page.getByRole("link",{name:/Mes réglages/}).click();
  await page.getByText("Aide à l’affichage",{exact:true}).click();
  const report=page.getByLabel("Diagnostic de l’écran",{exact:true});
  await expect(report).toHaveAttribute("readonly","");
  const initial=JSON.parse(await report.inputValue());
  expect(initial.version).toBe("affichage-20261022-2");
  expect(initial.releves[0].viewport).toContain("viewport-fit=auto");
  expect(initial.releves[0].barreSysteme).toBe("black");
  expect(initial.releves[0].etape).toBe("ouverture");
  expect(initial.releves[0].navigation).toHaveLength(3);
  expect(initial.releves[0].unites).toHaveLength(3);
  expect(initial.releves[0].zones).toHaveLength(4);
  for(let i=0;i<14;i++)await page.getByRole("button",{name:"Relever l’affichage actuel",exact:true}).click();
  const bounded=JSON.parse(await report.inputValue());
  expect(bounded.releves).toHaveLength(12);
  expect(bounded.releves[0]).toEqual(initial.releves[0]);
  expect(bounded.releves.at(-1).etape).toBe("relevé manuel");
  await page.reload();
  await page.getByText("Aide à l’affichage",{exact:true}).click();
  await expect.poll(async()=>JSON.parse(await report.inputValue()).releves.length).toBeGreaterThan(0);
  expect(JSON.parse(await report.inputValue()).releves.length).toBeLessThan(12);
});
