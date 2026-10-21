"use client";
import {subscribeDevice,type NotificationState} from "../actions";

export function supportsDevicePush(){return window.isSecureContext&&"serviceWorker" in navigator&&typeof window.PushManager!=="undefined"&&typeof window.Notification!=="undefined";}

export async function activateDevice(publicKey:string,progress:(message:string)=>void):Promise<NotificationState>{
  try{
    if(!supportsDevicePush())return{message:"Ce navigateur ne prend pas en charge les notifications Push. Sur iPhone ou iPad compatible, ajoutez d’abord l’application à l’écran d’accueil."};
    if(!publicKey)return{message:"Le Push n’est pas encore configuré. Vos notifications restent disponibles dans Accueil."};
    if(Notification.permission==="denied")return{message:"Les notifications sont bloquées. Autorisez-les dans les réglages de l’appareil ou du navigateur, puis réessayez."};
    // Aucun travail asynchrone avant cette demande : préserver le geste utilisateur sur iOS.
    const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    if(permission!=="granted")return{message:"Autorisation non accordée. Vous pouvez continuer à consulter vos notifications dans Accueil."};
    progress("Préparation des notifications…");
    await navigator.serviceWorker.register("/sw.js",{scope:"/"});
    let timer:ReturnType<typeof setTimeout>|undefined;
    const registration=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("service worker indisponible")),15000);})]).finally(()=>clearTimeout(timer));
    const key=Uint8Array.from(atob(publicKey.replace(/-/g,"+").replace(/_/g,"/")),character=>character.charCodeAt(0));
    const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    return await subscribeDevice(subscription.toJSON());
  }catch{return{message:"Activation impossible. Vérifiez votre connexion et les autorisations de ce navigateur puis réessayez."};}
}
