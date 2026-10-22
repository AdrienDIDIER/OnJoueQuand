"use client";
import {useEffect,useRef,useState,useSyncExternalStore,useTransition} from "react";
import {useRouter,usePathname,useSearchParams} from "next/navigation";
import {Button} from "@/components/ui/button";
import {InstallationHelp} from "./installation";
import {usePrivateNavigation} from "@/features/navigation/client";
function subscribeConnectivity(changed:()=>void){window.addEventListener("online",changed);window.addEventListener("offline",changed);return()=>{window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};}
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
  const offline=useSyncExternalStore(subscribeConnectivity,()=>!navigator.onLine,()=>false);
  const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
  const [refreshing,startRefresh]=useTransition();
  useEffect(()=>{window.dispatchEvent(new CustomEvent("ojq:refresh-state",{detail:refreshing}));},[refreshing]);
  const [changed,setChanged]=useState(false),[acknowledged,setAcknowledged]=useState(false),[editedPlace,setEditedPlace]=useState<string|null>(null),[message,setMessage]=useState("");
  const edited=editedPlace===place;
  useEffect(()=>{
    let disposed=false,hadController=!!navigator.serviceWorker?.controller;
    const currentPlace=()=>window.location.pathname+window.location.search;
    const rememberEdits=()=>{if(dirty.current===currentPlace()||restoredFormValues()){dirty.current=currentPlace();setEditedPlace(currentPlace());return true;}return false;};
    const edit=(event:Event)=>{if((event.target as Element)?.closest?.("form")){dirty.current=currentPlace();setEditedPlace(currentPlace());setAcknowledged(false);}};
    const refreshData=()=>startRefresh(async()=>{await verify(true);});
    const onlineEvent=refreshData;
    const manualRefresh=refreshData;
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
    const visibility=()=>{if(document.visibilityState==="visible")refreshData();};
    const focus=()=>{void verify(false);};
    const restored=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};
    const controllerChanged=()=>{rememberEdits();setWaiting(null);if(reloadRequested.current){location.reload();return;}if(hadController)setChanged(true);hadController=true;};
    window.addEventListener("online",onlineEvent);window.addEventListener("focus",focus);window.addEventListener("ojq:refresh",manualRefresh);window.addEventListener("pageshow",restored);
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
    return()=>{disposed=true;window.removeEventListener("online",onlineEvent);window.removeEventListener("focus",focus);window.removeEventListener("ojq:refresh",manualRefresh);window.removeEventListener("pageshow",restored);document.removeEventListener("input",edit,true);document.removeEventListener("change",edit,true);document.removeEventListener("submit",preventOfflineSubmit,true);document.removeEventListener("click",offlineNavigation,true);document.removeEventListener("visibilitychange",visibility);navigator.serviceWorker?.removeEventListener("controllerchange",controllerChanged);if(registration&&updateFound)registration.removeEventListener("updatefound",updateFound);for(const {worker,listener} of workerStates)worker.removeEventListener("statechange",listener);};
  },[router,validate]);
  function refresh(){
    if(edited&&!acknowledged)return;
    if(waiting&&waiting.state!=="activated"&&waiting.state!=="redundant"){reloadRequested.current=true;waiting.postMessage({type:"ACTIVATE_UPDATE"});setMessage("Mise à jour en cours…");}else location.reload();
  }
  return <aside className="pwa-panel" aria-label="Application et connexion">
    {offline&&<p role="status" className="pwa-notice">Connexion interrompue. Vos saisies restent sur cette page. Aucune modification n’est enregistrée hors connexion.</p>}
    {(waiting||changed)&&<section className="pwa-update" aria-label="Mise à jour disponible"><h2>Une mise à jour est disponible.</h2><p>Enregistrez ou abandonnez vos saisies avant d’actualiser. Aucun rechargement automatique ne sera effectué.</p>{edited&&<label className="pwa-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>Mes saisies sont enregistrées ou peuvent être abandonnées</label>}<Button type="button" disabled={offline||(edited&&!acknowledged)} onClick={refresh}>Actualiser l’application</Button></section>}
    {pathname==="/groupe/reglages"&&<InstallationHelp/>}
    <p role="status">{message}</p>
  </aside>;
}
