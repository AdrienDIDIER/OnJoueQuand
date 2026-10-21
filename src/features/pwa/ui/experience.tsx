"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from "react";
import {useRouter,usePathname,useSearchParams} from "next/navigation";
import {Button} from "@/components/ui/button";
import {installationMode} from "../domain";
import {usePrivateNavigation} from "@/features/navigation/client";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
function subscribeConnectivity(changed:()=>void){window.addEventListener("online",changed);window.addEventListener("offline",changed);return()=>{window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};}
function subscribeDisplay(changed:()=>void){const media=matchMedia("(display-mode: standalone)");media.addEventListener("change",changed);return()=>media.removeEventListener("change",changed);}
function browserMode(){return installationMode({userAgent:navigator.userAgent,platform:navigator.platform,touchPoints:navigator.maxTouchPoints,standalone:matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone});}
function restoredFormValues(){
  // Certains navigateurs restaurent/autoremplissent les champs sans événement input.
  return Array.from(document.querySelectorAll("form input,form textarea,form select")).some(field=>{
    if(field instanceof HTMLInputElement){if(["hidden","submit","button"].includes(field.type))return false;return["checkbox","radio"].includes(field.type)?field.checked!==field.defaultChecked:field.value!==field.defaultValue;}
    if(field instanceof HTMLTextAreaElement)return field.value!==field.defaultValue;
    if(field instanceof HTMLSelectElement){const defaults=Array.from(field.options).filter(o=>o.defaultSelected).map(o=>o.value);const original=defaults.length?defaults:field.multiple?[]:[field.options[0]?.value];return Array.from(field.selectedOptions).map(o=>o.value).join("\0")!==original.join("\0");}return false;
  });
}
export function PwaExperience(){
  const {validate}=usePrivateNavigation();
  const pathname=usePathname();
  const search=useSearchParams().toString(),place=pathname+(search?`?${search}`:"");
  const router=useRouter();const dirty=useRef<string|null>(null),checking=useRef(false),reloadRequested=useRef(false);
  const [installedNow,setInstalledNow]=useState(false);
  const detectedMode=useSyncExternalStore(subscribeDisplay,browserMode,()=>"browser" as const),mode=installedNow?"installed":detectedMode;
  const offline=useSyncExternalStore(subscribeConnectivity,()=>!navigator.onLine,()=>false);
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[waiting,setWaiting]=useState<ServiceWorker|null>(null);
  const [changed,setChanged]=useState(false),[acknowledged,setAcknowledged]=useState(false),[editedPlace,setEditedPlace]=useState<string|null>(null),[message,setMessage]=useState("");
  const edited=editedPlace===place;
  useEffect(()=>{
    let disposed=false,hadController=!!navigator.serviceWorker?.controller;
    const currentPlace=()=>window.location.pathname+window.location.search;
    const rememberEdits=()=>{if(dirty.current===currentPlace()||restoredFormValues()){dirty.current=currentPlace();setEditedPlace(currentPlace());return true;}return false;};
    const installed=()=>{setInstalledNow(true);setPrompt(null);setMessage("OnJoueQuand est installé sur cet appareil.");};
    const beforeInstall=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const edit=(event:Event)=>{if((event.target as Element)?.closest?.("form")){dirty.current=currentPlace();setEditedPlace(currentPlace());setAcknowledged(false);}};
    const onlineEvent=()=>{void verify(true);};
    const manualRefresh=()=>{void verify(true);};
    const preventOfflineSubmit=(event:Event)=>{if(!navigator.onLine){event.preventDefault();event.stopImmediatePropagation();setMessage("Enregistrement impossible hors connexion. Votre saisie est conservée sur cette page ; réessayez après reconnexion.");}};
    const offlineNavigation=(event:MouseEvent)=>{
      if(navigator.onLine||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const link=(event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement|null;
      if(link&&link.origin===location.origin&&!link.getAttribute("href")?.startsWith("#")){event.preventDefault();event.stopImmediatePropagation();location.assign(link.href);}
    };
    const verify=async(refreshData=false)=>{
      if(checking.current||!navigator.onLine||document.visibilityState==="hidden")return;checking.current=true;
      try{
        const valid=await validate();
        if(disposed)return;
        if(!valid)return;
        // Le simple focus (clavier, panneau) ne vide plus le cache de navigation.
        if(refreshData&&!rememberEdits())router.refresh();
        else if(rememberEdits())setMessage("La connexion est disponible. Vos saisies sont conservées ; actualisez après les avoir enregistrées ou abandonnées.");
      }catch{if(!disposed)setMessage("Connexion au service impossible. Vos saisies restent sur cette page.");}finally{checking.current=false;}
    };
    const visibility=()=>{if(document.visibilityState==="visible")void verify(true);};
    const focus=()=>{void verify(false);};
    const restored=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};
    const controllerChanged=()=>{rememberEdits();setWaiting(null);if(reloadRequested.current){location.reload();return;}if(hadController)setChanged(true);hadController=true;};
    window.addEventListener("beforeinstallprompt",beforeInstall);window.addEventListener("appinstalled",installed);window.addEventListener("online",onlineEvent);window.addEventListener("focus",focus);window.addEventListener("ojq:refresh",manualRefresh);window.addEventListener("pageshow",restored);
    document.addEventListener("input",edit,true);document.addEventListener("change",edit,true);document.addEventListener("submit",preventOfflineSubmit,true);document.addEventListener("click",offlineNavigation,true);document.addEventListener("visibilitychange",visibility);
    const workerStates:Array<{worker:ServiceWorker;listener:()=>void}>=[];let registration:ServiceWorkerRegistration|undefined;let updateFound:(()=>void)|undefined;
    if("serviceWorker" in navigator&&window.isSecureContext){
      navigator.serviceWorker.addEventListener("controllerchange",controllerChanged);
      void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(reg=>{
        if(disposed)return;registration=reg;if(reg.waiting){rememberEdits();setWaiting(reg.waiting);}
        updateFound=()=>{const worker=reg.installing;if(!worker)return;const listener=()=>{if(!disposed&&worker.state==="installed"&&reg.waiting){rememberEdits();setWaiting(reg.waiting);}};worker.addEventListener("statechange",listener);workerStates.push({worker,listener});};
        reg.addEventListener("updatefound",updateFound);if(reg.installing)updateFound();
      }).catch(()=>{if(!disposed)setMessage("L’installation hors connexion est indisponible pour le moment. Vous pouvez continuer en ligne.");});
    }
    return()=>{disposed=true;window.removeEventListener("beforeinstallprompt",beforeInstall);window.removeEventListener("appinstalled",installed);window.removeEventListener("online",onlineEvent);window.removeEventListener("focus",focus);window.removeEventListener("ojq:refresh",manualRefresh);window.removeEventListener("pageshow",restored);document.removeEventListener("input",edit,true);document.removeEventListener("change",edit,true);document.removeEventListener("submit",preventOfflineSubmit,true);document.removeEventListener("click",offlineNavigation,true);document.removeEventListener("visibilitychange",visibility);navigator.serviceWorker?.removeEventListener("controllerchange",controllerChanged);if(registration&&updateFound)registration.removeEventListener("updatefound",updateFound);for(const {worker,listener} of workerStates)worker.removeEventListener("statechange",listener);};
  },[router,validate]);
  async function install(){
    if(!prompt)return;const request=prompt;setPrompt(null);
    try{await request.prompt();const choice=await request.userChoice;setMessage(choice.outcome==="accepted"?"Installation demandée. Suivez les indications du navigateur.":"Installation reportée. Vous pouvez continuer dans ce navigateur.");}catch{setMessage("Utilisez le menu de votre navigateur pour installer l’application s’il le propose.");}
  }
  function refresh(){
    if(edited&&!acknowledged)return;
    if(waiting&&waiting.state!=="activated"&&waiting.state!=="redundant"){reloadRequested.current=true;waiting.postMessage({type:"ACTIVATE_UPDATE"});setMessage("Mise à jour en cours…");}else location.reload();
  }
  return <aside className="pwa-panel" aria-label="Application et connexion">
    {offline&&<p role="status" className="pwa-notice">Connexion interrompue. Vos saisies restent sur cette page. Aucune modification n’est enregistrée hors connexion.</p>}
    {(waiting||changed)&&<section className="pwa-update" aria-label="Mise à jour disponible"><h2>Une mise à jour est disponible.</h2><p>Enregistrez ou abandonnez vos saisies avant d’actualiser. Aucun rechargement automatique ne sera effectué.</p>{edited&&<label className="pwa-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>Mes saisies sont enregistrées ou peuvent être abandonnées</label>}<Button type="button" disabled={offline||(edited&&!acknowledged)} onClick={refresh}>Actualiser l’application</Button></section>}
    {pathname==="/groupe/reglages"&&mode!=="installed"&&<details className="pwa-install"><summary>Installer OnJoueQuand</summary><h2>Votre groupe, à portée de main.</h2>{mode==="ios"?<ol><li>Ouvrez OnJoueQuand dans Safari.</li><li>Ouvrez le menu de partage, puis choisissez « Sur l’écran d’accueil ».</li><li>Validez « Ajouter », puis ouvrez l’icône OnJoueQuand.</li></ol>:<><p>Si votre navigateur le propose, ouvrez son menu puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ». Cette option dépend du navigateur.</p>{prompt&&<Button type="button" onClick={install}>Installer l’application</Button>}</>}<p>L’installation n’active pas les notifications : elles se règlent sur cette page.</p></details>}
    <p role="status">{message}</p>
  </aside>;
}
