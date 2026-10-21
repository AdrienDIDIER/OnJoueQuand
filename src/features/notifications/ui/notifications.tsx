"use client";
import Link from "next/link";
import {useActionState,useState} from "react";
import {Button} from "@/components/ui/button";
import {dateTimeLabel} from "@/lib/time/paris";
import {notificationAction,subscribeDevice,type NotificationState} from "../actions";
import type {loadInbox,loadNotificationSettings} from "../server";
import {jobHealthSchema,jobHealthAlerts} from "../domain/job-health";
const initial:NotificationState={message:""};
function Note({note}:{note:Awaited<ReturnType<typeof loadInbox>>["notes"][number]}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <li className="notification-note"><p className="eyebrow">{note.read_at?"Lue":"Non lue"}</p><h3>{note.title}</h3><p>{note.body}</p><p className="notification-date">{dateTimeLabel(note.created_at)}</p><Link className="text-link" href={note.url}>Consulter</Link>{!note.read_at&&<form action={action}><input type="hidden" name="command" value="read"/><input type="hidden" name="id" value={note.id}/><input type="hidden" name="revision" value={note.revision}/><Button variant="outline" disabled={pending}>Marquer comme lue</Button><p role="status">{state.message}</p></form>}</li>;
}
export function Inbox({view}:{view:Awaited<ReturnType<typeof loadInbox>>}){
  return <section id="notifications" className="group-card" aria-labelledby="notifications-title"><div className="section-heading"><h2 id="notifications-title">Vos notifications</h2><span>{view.unread} non lue(s)</span></div><p>Les vingt dernières informations de votre groupe. Les liens affichent toujours l’état actuel.</p>{view.notes.length?<ul className="notification-list">{view.notes.map(note=><Note key={`${note.id}-${note.revision}`} note={note}/>)}</ul>:<p>Aucune notification pour le moment.</p>}</section>;
}
function DevicePush({publicKey}:{publicKey:string}){
  const [message,setMessage]=useState(publicKey?"":"Les notifications sur cet appareil ne sont pas encore configurées par l’administrateur. Vos notifications restent disponibles dans Accueil."),[pending,setPending]=useState(false);
  async function enable(){
    setPending(true);
    setMessage("Vérification des notifications sur cet appareil…");
    try{
      if(!window.isSecureContext||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setMessage("Ce navigateur ne prend pas en charge les notifications Push. Sur iPhone ou iPad compatible, ajoutez d’abord l’application à l’écran d’accueil.");return;}
      if(!publicKey){setMessage("Le Push n’est pas encore configuré. Vos notifications restent disponibles dans Accueil.");return;}
      const permission=await Notification.requestPermission();if(permission!=="granted"){setMessage("Autorisation non accordée. Vous pouvez continuer à consulter vos notifications dans Accueil.");return;}
      setMessage("Préparation des notifications…");
      await navigator.serviceWorker.register("/sw.js",{scope:"/"});
      let timer:ReturnType<typeof setTimeout>|undefined;
      const registration=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("service worker indisponible")),15000);})]).finally(()=>clearTimeout(timer));
      const key=Uint8Array.from(atob(publicKey.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
      const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      const result=await subscribeDevice(subscription.toJSON());setMessage(result.message);
    }catch{setMessage("Activation impossible. Vérifiez votre connexion et les autorisations de ce navigateur puis réessayez.");}finally{setPending(false);}
  }
  async function disable(){
    setPending(true);try{const registration=await navigator.serviceWorker.getRegistration("/");const subscription=await registration?.pushManager.getSubscription();if(subscription)await subscription.unsubscribe();setMessage("Abonnement désactivé dans ce navigateur. Vous pouvez aussi retirer sa ligne dans la liste des appareils.");}catch{setMessage("Désactivation impossible dans ce navigateur.");}finally{setPending(false);}
  }
  return <div className="device-push"><p>Le Push est facultatif. Demandez l’autorisation uniquement sur vos appareils personnels. Sur iOS compatible, l’application doit être ajoutée à l’écran d’accueil.</p><div className="notification-buttons"><Button type="button" disabled={pending} onClick={enable}>Activer sur cet appareil</Button><Button type="button" variant="outline" disabled={pending} onClick={disable}>Désactiver dans ce navigateur</Button></div><p role="status">{message}</p></div>;
}
function Device({device}:{device:Awaited<ReturnType<typeof loadNotificationSettings>>["subscriptions"][number]}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <li><p>Appareil ajouté le {dateTimeLabel(device.created_at)}</p><form action={action}><input type="hidden" name="command" value="unsubscribe"/><input type="hidden" name="id" value={device.id}/><input type="hidden" name="revision" value={device.revision}/><Button variant="outline" disabled={pending}>Retirer cet appareil</Button><p role="status">{state.message}</p></form></li>;
}
export function NotificationSettings({view}:{view:Awaited<ReturnType<typeof loadNotificationSettings>>}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <section className="group-card" aria-labelledby="notification-settings-title"><h2 id="notification-settings-title">Mes notifications</h2><p>Les informations de session restent dans Accueil. Les rappels concernent seulement vos semaines incomplètes.</p>
    <form key={view.preferences?.revision??0} action={action} className="form-stack"><input type="hidden" name="command" value="preferences"/><input type="hidden" name="revision" value={view.preferences?.revision??""}/><label className="checkbox-label"><input type="checkbox" name="reminders" defaultChecked={view.preferences?.reminders_enabled??true}/>Rappels de disponibilités le dimanche et le lundi</label><label className="checkbox-label"><input type="checkbox" name="push" defaultChecked={view.preferences?.push_enabled??false}/>Autoriser le Push sur mes appareils enregistrés</label><Button disabled={pending}>Enregistrer mes préférences</Button><p role="status">{state.message}</p></form>
    <DevicePush publicKey={view.publicKey}/><h3>Mes appareils</h3>{view.subscriptions.length?<ul className="notification-list">{view.subscriptions.map(d=><Device key={`${d.id}-${d.revision}`} device={d}/>)}</ul>:<p>Aucun appareil enregistré.</p>}
    {view.status&&<details><summary>Suivi du traitement (administration)</summary><JobStatus status={view.status}/></details>}
  </section>;
}
function JobStatus({status}:{status:unknown}){
  const parsed=jobHealthSchema.safeParse(status);
  if(!parsed.success)return <p>État technique indisponible. Réessayez après actualisation.</p>;
  const s=parsed.data,alerts=jobHealthAlerts(s);
  return <><h3>État technique</h3><p>Vérifié le {dateTimeLabel(s.checked_at)} · heure de Paris.</p>
    {alerts.length?<ul>{alerts.map(message=><li key={message}>{message}</li>)}</ul>:<p>Ordonnanceur et traitement opérationnels.</p>}
    <p>{s.last_run?`Dernier passage : ${dateTimeLabel(s.last_run.started_at)} · ${{running:"en cours",completed:"terminé",failed:"en échec",abandoned:"interrompu"}[s.last_run.status]}`:"Aucun traitement exécuté."}</p>
    {s.last_success_at&&<p>Dernier succès : {dateTimeLabel(s.last_success_at)}.</p>}
    <p>Événements en attente : {s.outbox_pending} · en échec : {s.outbox_failed}. Envois en attente : {s.deliveries_pending} · en échec : {s.deliveries_failed}.</p>
    <p>Ce contrôle ne vérifie ni la livraison réelle du Push ni les sauvegardes privées.</p></>;
}
