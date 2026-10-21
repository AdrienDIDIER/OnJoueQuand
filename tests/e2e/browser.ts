import {test as base,type BrowserContext} from "@playwright/test";

// Les autres parcours simulent un visiteur ayant déjà choisi « Plus tard ».
// installation.spec.ts teste le premier démarrage avec un contexte vierge.
export async function postponeInstallation(context:BrowserContext){
  await context.addInitScript(()=>{try{localStorage.setItem("ojq-install-later-until","4102444800000");}catch{/* Stockage inaccessible sur about:blank. */}});
}
export const test=base.extend({context:async({context},provide)=>{await postponeInstallation(context);await provide(context);}});
