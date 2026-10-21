"use client";
import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {Download,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {installationMode} from "../domain";

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
const LATER_KEY="ojq-install-later-until";
const LATER_MS=7*24*60*60_000;
function subscribeDisplay(changed:()=>void){const media=matchMedia("(display-mode: standalone)");media.addEventListener("change",changed);return()=>media.removeEventListener("change",changed);}
function browserMode(){return installationMode({userAgent:navigator.userAgent,platform:navigator.platform,touchPoints:navigator.maxTouchPoints,standalone:matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone});}
type Installation={mode:ReturnType<typeof browserMode>;launchMode:ReturnType<typeof browserMode>;available:boolean;pending:boolean;message:string;install:()=>Promise<void>};
const Context=createContext<Installation|null>(null);
export function useInstallationMode(){return useContext(Context)?.launchMode??"browser";}

function Instructions({ios}:{ios:boolean}){
  return ios?<ol><li>Ouvrez ce site dans <strong>Safari</strong>.</li><li>Touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</li><li>Validez <strong>Ajouter</strong>, puis ouvrez l’icône OnJoueQuand.</li></ol>:<p>Ouvrez le menu de votre navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil » si cette option est proposée.</p>;
}

export function InstallationProvider({children}:{children:ReactNode}){
  const detected=useSyncExternalStore(subscribeDisplay,browserMode,()=>"browser" as const);
  const [installed,setInstalled]=useState(false),[visible,setVisible]=useState(false);
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[pending,setPending]=useState(false),[message,setMessage]=useState("");
  const mode=installed?"installed":detected;
  const dialog=useRef<HTMLDialogElement>(null),previousFocus=useRef<HTMLElement|null>(null),busy=useRef(false);
  function later(){
    try{localStorage.setItem(LATER_KEY,String(Date.now()+LATER_MS));}catch{/* La fermeture reste possible si le stockage est bloqué. */}
    setVisible(false);
  }
  useEffect(()=>{
    const beforeInstall=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const appInstalled=()=>{setInstalled(true);setPrompt(null);setVisible(false);setMessage("OnJoueQuand est installé sur cet appareil.");};
    window.addEventListener("beforeinstallprompt",beforeInstall);window.addEventListener("appinstalled",appInstalled);
    const timer=setTimeout(()=>{
      if(browserMode()==="installed"||document.visibilityState==="hidden"||document.querySelector("dialog[open]"))return;
      try{if(Number(localStorage.getItem(LATER_KEY))>Date.now())return;}catch{/* Sans stockage, proposer une fois pour ce chargement. */}
      setVisible(true);
    },700);
    return()=>{clearTimeout(timer);window.removeEventListener("beforeinstallprompt",beforeInstall);window.removeEventListener("appinstalled",appInstalled);};
  },[]);
  useEffect(()=>{
    const element=dialog.current;if(!element)return;
    if(visible&&mode!=="installed"){
      if(!element.open){previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;element.showModal();}
    }else if(element.open)element.close();
  },[visible,mode]);
  async function install(){
    if(!prompt||busy.current)return;
    const request=prompt;busy.current=true;setPending(true);setPrompt(null);
    try{
      // L'appel reste directement lié au clic ; aucun navigateur ne peut être forcé à installer.
      await request.prompt();const choice=await request.userChoice;
      setMessage(choice.outcome==="accepted"?"Installation demandée. Suivez les indications du navigateur.":"Installation reportée. Vous pouvez continuer dans ce navigateur.");
      later();
    }catch{setMessage("L’installation automatique est indisponible. Utilisez le menu de votre navigateur.");}
    finally{busy.current=false;setPending(false);}
  }
  return <Context value={{mode,launchMode:detected,available:!!prompt,pending,message,install}}>{children}
    <dialog ref={dialog} className="install-dialog" aria-labelledby="install-invitation-title" onClose={()=>{later();if(previousFocus.current?.isConnected)previousFocus.current.focus({preventScroll:true});}}>
      {visible&&mode!=="installed"&&<>
      <button type="button" className="install-close" aria-label="Fermer l’invitation" onClick={later}><X size={22} aria-hidden="true"/></button>
      <span className="install-emblem"><Download size={24} aria-hidden="true"/></span>
      <h2 id="install-invitation-title">Votre groupe, à portée de main.</h2>
      <p>Ajoutez OnJoueQuand à votre écran d’accueil pour retrouver vos soirées comme dans une application.</p>
      {!prompt&&<Instructions ios={mode==="ios"}/>}
      <p className="form-hint">L’installation est gratuite. Les notifications s’activent ensuite dans vos réglages.</p>
      <div className="install-actions">{prompt&&<Button type="button" disabled={pending} onClick={install}>Installer l’application</Button>}<Button type="button" variant="outline" disabled={pending} onClick={later}>Plus tard</Button></div>
      <p role="status">{message}</p>
      </>}
    </dialog>
  </Context>;
}

export function InstallationHelp(){
  const context=useContext(Context);if(!context||context.mode==="installed")return null;
  return <details className="pwa-install"><summary>Installer OnJoueQuand</summary><h2>Votre groupe, à portée de main.</h2><Instructions ios={context.mode==="ios"}/>{context.available&&<Button type="button" disabled={context.pending} onClick={context.install}>Installer l’application</Button>}<p>L’installation n’active pas les notifications : elles se règlent sur cette page.</p><p role="status">{context.message}</p></details>;
}
