import {expect} from "@playwright/test";
import {test} from "./fixtures";

test("le test de notification explique l’activation sans demander une permission silencieuse",async({page})=>{
  await page.goto("/groupe/reglages");
  await page.getByRole("button",{name:"Tester les notifications",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Activez d’abord les notifications sur cet appareil."})).toBeVisible();
});

test("un soir sélectionné ouvre directement un formulaire court sans votes",async({page},info)=>{
  await page.goto("/sessions?soir=2027-01-15");
  const dialog=page.getByRole("dialog",{name:"Organiser une soirée",exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Quel soir ?",{exact:true})).toHaveValue("2027-01-15");
  await expect(dialog.getByLabel("On commence à quelle heure ?",{exact:true})).toHaveValue("20:00");
  await expect(dialog.getByText("Ajouter un créneau",{exact:true})).toHaveCount(0);
  await expect(dialog.getByLabel("Nom de la soirée",{exact:true})).not.toBeVisible();
  await page.screenshot({path:info.outputPath("organiser-soiree.png")});
});
