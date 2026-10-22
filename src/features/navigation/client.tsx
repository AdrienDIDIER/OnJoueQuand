"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,useTransition,type ReactNode} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {LoadingPlaceholder} from "@/components/ui/loading";

const cachedPages=new Set(["/accueil","/dispos","/sessions","/groupe"]);
type Probe={status:number;accessKey?:string};
let inFlight:Promise<Probe>|undefined;

// Dédupliquer seulement les vérifications simultanées, jamais réutiliser un ancien droit.
function probe(deduplicate=true):Promise<Probe> {
  if(deduplicate&&inFlight)return inFlight;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  const request=(async():Promise<Probe>=>{
    try {
      const response=await fetch("/api/session-status",{cache:"no-store",credentials:"same-origin",signal:controller.signal});
      if(!response.ok)return{status:response.status};
      const data:unknown=await response.json();
      if(!data||typeof data!=="object"||!("accessKey" in data)||typeof data.accessKey!=="string"||!(/^[a-f0-9]{64}$/).test(data.accessKey))return{status:503};
      return{status:200,accessKey:data.accessKey};
    } catch {return{status:503};}
    finally {clearTimeout(timer);}
  })();
  if(deduplicate){inFlight=request;void request.finally(()=>{if(inFlight===request)inFlight=undefined;});}
  return request;
}

type NavigationContext={accessKey:string;pendingPath:string|null;validate:(target?:string)=>Promise<boolean>};
const Context=createContext<NavigationContext|null>(null);
export function usePrivateNavigation(){const value=useContext(Context);if(!value)throw new Error("Contexte de navigation absent.");return value;}

export function NavigationCache({accessKey,children}:{accessKey:string;children:ReactNode}) {
  const router=useRouter(),pathname=usePathname(),search=useSearchParams().toString();
  const locationKey=pathname+(search?`?${search}`:"");
  const [verifiedLocation,setVerifiedLocation]=useState(locationKey);
  const [target,setTarget]=useState<string|null>(null),[error,setError]=useState("");
  const [blocked,setBlocked]=useState(false);
  const [initialAccessKey]=useState(accessKey);
  const contextChanged=initialAccessKey!==accessKey;
  const [pending,startTransition]=useTransition();
  const sequence=useRef(0);
  const alive=useRef(true);
  const redirecting=useRef(false),intent=useRef<string|null>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{if(contextChanged){redirecting.current=true;window.location.replace(window.location.href);}},[contextChanged]);
  const receive=useCallback((result:Probe,destination?:string)=>{
    if(!alive.current||redirecting.current)return false;
    if(result.status===401||result.status===403){redirecting.current=true;setBlocked(true);window.location.replace("/connexion");return false;}
    if(result.status!==200){setError("Connexion au groupe impossible. Réessayez dans un instant.");return false;}
    if(result.accessKey!==accessKey){redirecting.current=true;setBlocked(true);window.location.replace(intent.current??destination??window.location.href);return false;}
    setError("");return true;
  },[accessKey]);
  const validate=useCallback(async(destination?:string)=>receive(await probe(),destination),[receive]);

  useEffect(()=>{
    const capture=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!navigator.onLine)return;
      const anchor=(event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement|null;
      if(!anchor||anchor.target&&anchor.target!=="_self"||anchor.hasAttribute("download"))return;
      const url=new URL(anchor.href);
      if(url.origin!==window.location.origin||!/^\/(accueil|dispos|sessions|groupe)(\/|$)/.test(url.pathname))return;
      const nextLocation=url.pathname+url.search;
      if(nextLocation===locationKey){
        // Un lien d’ancre garde son comportement natif ; retoucher l’onglet courant ne relance rien.
        setTarget(null);
        if(!url.hash){event.preventDefault();event.stopImmediatePropagation();}
        return;
      }
      event.preventDefault();event.stopImmediatePropagation();
      const serial=++sequence.current;
      intent.current=nextLocation+url.hash;
      setTarget(url.pathname);setError("");
      // Réafficher le snapshot déjà reçu sans attendre le réseau. Toute nouvelle lecture reste autorisée au serveur.
      startTransition(()=>{setVerifiedLocation(nextLocation);router.push(nextLocation+url.hash);});
      void probe(false).then(result=>{
        if(serial===sequence.current)receive(result,nextLocation+url.hash);
      });
    };
    document.addEventListener("click",capture,true);
    return()=>document.removeEventListener("click",capture,true);
  },[locationKey,router,receive]);

  // Historique : les quatre onglets reçus sont réaffichés immédiatement ; les sous-routes restent masquées.
  useEffect(()=>{
    if(blocked)return;
    if(locationKey===verifiedLocation){intent.current=null;return;}
    let cancelled=false;
    void probe().then(result=>{if(!cancelled&&receive(result,locationKey))setVerifiedLocation(locationKey);});
    return()=>{cancelled=true;};
  },[locationKey,verifiedLocation,receive,blocked]);
  const gated=blocked||contextChanged||(locationKey!==verifiedLocation&&!(cachedPages.has(pathname)&&!search));
  return <Context value={{accessKey,pendingPath:pending?target:null,validate}}>
    <div hidden={gated}>{children}</div>
    {gated&&<div className="navigation-check"><LoadingPlaceholder label="On retrouve votre groupe…" shape="page"/>{error&&<><p role="status">{error}</p><button type="button" onClick={()=>window.location.reload()}>Réessayer</button></>}</div>}
    {!gated&&error&&<p className="navigation-error" role="status">{error}</p>}
  </Context>;
}
