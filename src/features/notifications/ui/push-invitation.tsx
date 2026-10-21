"use client";
import {useEffect,useRef,useState} from "react";
import {Bell,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useInstallationMode} from "@/features/pwa/client";
import {pushInvitationStatus} from "../actions";
import {activateDevice,supportsDevicePush} from "./activate-device";

const LATER_KEY="ojq-push-later-until";
export function PushInvitation({publicKey}:{publicKey:string}){
  const mode=useInstallationMode();
  const [visible,setVisible]=useState(false),[pending,setPending]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState("");
  const dialog=useRef<HTMLDialogElement>(null),previousFocus=useRef<HTMLElement|null>(null),busy=useRef(false);
  function later(){try{localStorage.setItem(LATER_KEY,String(Date.now()+7*86400000));}catch{/* Préférence facultative. */}setVisible(false);}
  useEffect(()=>{
    if(mode!=="installed"||!publicKey)return;
    let disposed=false;
    const timer=setTimeout(async()=>{
      try{
        if(!supportsDevicePush()||Notification.permission==="denied"||document.visibilityState==="hidden"||document.querySelector("dialog[open]"))return;
        try{if(Number(localStorage.getItem(LATER_KEY))>Date.now())return;}catch{/* Proposer reste possible sans stockage. */}
        const registration=await navigator.serviceWorker.getRegistration("/");
        const subscription=await registration?.pushManager.getSubscription();
        const status=await pushInvitationStatus(subscription?.endpoint??null);
        if(!disposed&&status==="missing"&&!document.querySelector("dialog[open]"))setVisible(true);
      }catch{/* Une vérification indisponible ne doit pas interrompre le démarrage. */}
    },900);
    return()=>{disposed=true;clearTimeout(timer);};
  },[mode,publicKey]);
  useEffect(()=>{
    const element=dialog.current;if(!element)return;
    if(visible&&mode==="installed"){
      if(!element.open){previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;element.showModal();}
    }else if(element.open)element.close();
  },[visible,mode]);
  async function enable(){
    if(busy.current)return;busy.current=true;setPending(true);setMessage("Activation des notifications…");
    try{
      const result=await activateDevice(publicKey,setMessage);setMessage(result.message);
      if(result.done)later();else if("Notification" in window&&Notification.permission==="denied")setBlocked(true);
    }finally{busy.current=false;setPending(false);}
  }
  return <dialog ref={dialog} className="install-dialog" aria-labelledby="push-invitation-title" onClose={()=>{later();if(previousFocus.current?.isConnected)previousFocus.current.focus({preventScroll:true});}}>
    {visible&&mode==="installed"&&<>
      <button type="button" className="install-close" aria-label="Fermer l’invitation aux notifications" onClick={later}><X size={22} aria-hidden="true"/></button>
      <span className="install-emblem"><Bell size={24} aria-hidden="true"/></span>
      <h2 id="push-invitation-title">On vous prévient ?</h2>
      <p>Recevez les soirées organisées et un rappel pour vos dispos. Vous pourrez changer d’avis dans vos réglages.</p>
      <div className="install-actions">{!blocked&&<Button type="button" disabled={pending} onClick={enable}>{pending?"Activation…":"Activer les notifications"}</Button>}<Button type="button" variant="outline" onClick={later}>{blocked?"Continuer sans notifications":"Plus tard"}</Button></div>
      <p role="status">{message}</p>
    </>}
  </dialog>;
}
