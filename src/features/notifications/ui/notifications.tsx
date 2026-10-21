"use client";
import Link from "next/link";
import {useActionState,useState} from "react";
import {Button} from "@/components/ui/button";
import {dateTimeLabel} from "@/lib/time/paris";
import {notificationAction,testDeviceNotification,type NotificationState} from "../actions";
import type {loadInbox,loadNotificationSettings} from "../server";
import {jobHealthSchema,jobHealthAlerts} from "../domain/job-health";
import {activateDevice} from "./activate-device";
const initial:NotificationState={message:""};
function Note({note}:{note:Awaited<ReturnType<typeof loadInbox>>["notes"][number]}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <li className="notification-note"><p className="eyebrow">{note.read_at?"Lue":"Non lue"}</p><h3>{note.title}</h3><p>{note.body}</p><p className="notification-date">{dateTimeLabel(note.created_at)}</p><Link className="text-link" href={note.url}>Consulter</Link>{!note.read_at&&<form action={action}><input type="hidden" name="command" value="read"/><input type="hidden" name="id" value={note.id}/><input type="hidden" name="revision" value={note.revision}/><Button variant="outline" disabled={pending}>Marquer comme lue</Button><p role="status">{state.message}</p></form>}</li>;
}
export function Inbox({view}:{view:Awaited<ReturnType<typeof loadInbox>>}){
  return <section id="notifications" className="group-card" aria-labelledby="notifications-title"><div className="section-heading"><h2 id="notifications-title">Vos notifications</h2><span>{view.unread} non lue(s)</span></div>{view.notes.length?<ul className="notification-list">{view.notes.slice(0,3).map(note=><Note key={`${note.id}-${note.revision}`} note={note}/>)}</ul>:<p>Rien de nouveau pour le moment.</p>}{view.notes.length>3&&<details className="secondary-details"><summary>Voir les notifications précédentes</summary><ul className="notification-list">{view.notes.slice(3).map(note=><Note key={`${note.id}-${note.revision}`} note={note}/>)}</ul></details>}</section>;
}
function DevicePush({publicKey}:{publicKey:string}){
  const [message,setMessage]=useState(publicKey?"":"Les notifications sur cet appareil ne sont pas encore configurées par l’administrateur. Vos notifications restent disponibles dans Accueil."),[pending,setPending]=useState(false);
  async function enable(){
    setPending(true);setMessage("Vérification des notifications sur cet appareil…");
    try{setMessage((await activateDevice(publicKey,setMessage)).message);}finally{setPending(false);}
  }
  async function disable(){
    setPending(true);try{const registration=await navigator.serviceWorker.getRegistration("/");const subscription=await registration?.pushManager.getSubscription();if(subscription)await subscription.unsubscribe();setMessage("Abonnement désactivé dans ce navigateur. Vous pouvez aussi retirer sa ligne dans la liste des appareils.");}catch{setMessage("Désactivation impossible dans ce navigateur.");}finally{setPending(false);}
  }
  async function testNotification(){
    setPending(true);setMessage("Envoi du test…");
    try{
      if(!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator)){setMessage("Activez d’abord les notifications sur cet appareil.");return;}
      const registration=await navigator.serviceWorker.getRegistration("/");
      const subscription=await registration?.pushManager.getSubscription();
      if(!subscription){setMessage("Activez d’abord les notifications sur cet appareil.");return;}
      const result=await testDeviceNotification(subscription.endpoint);
      if(result.resetDevice)await subscription.unsubscribe();
      setMessage(result.message);
    }catch{setMessage("Test impossible. Vérifiez votre connexion et réessayez.");}finally{setPending(false);}
  }
  return <div className="device-push"><p>Recevez les rendez-vous et les rappels sur votre téléphone. Sur iPhone, ouvrez l’application depuis l’écran d’accueil.</p><div className="notification-buttons"><Button type="button" disabled={pending} onClick={enable}>{pending?"Patientez…":"Activer sur cet appareil"}</Button><Button type="button" variant="outline" disabled={pending} onClick={testNotification}>Tester les notifications</Button></div><p role="status">{message}</p><details className="secondary-details"><summary>Désactiver sur cet appareil</summary><Button type="button" variant="outline" disabled={pending} onClick={disable}>Désactiver dans ce navigateur</Button></details></div>;
}
function Device({device}:{device:Awaited<ReturnType<typeof loadNotificationSettings>>["subscriptions"][number]}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <li><p>Appareil ajouté le {dateTimeLabel(device.created_at)}</p><form action={action}><input type="hidden" name="command" value="unsubscribe"/><input type="hidden" name="id" value={device.id}/><input type="hidden" name="revision" value={device.revision}/><Button variant="outline" disabled={pending}>Retirer cet appareil</Button><p role="status">{state.message}</p></form></li>;
}
export function NotificationSettings({view}:{view:Awaited<ReturnType<typeof loadNotificationSettings>>}){
  const [state,action,pending]=useActionState(notificationAction,initial);
  return <section className="group-card" aria-labelledby="notification-settings-title"><h2 id="notification-settings-title">Mes notifications</h2><DevicePush publicKey={view.publicKey}/>
    <details className="secondary-details"><summary>Préférences de rappel</summary>
    <form key={view.preferences?.revision??0} action={action} className="form-stack"><input type="hidden" name="command" value="preferences"/><input type="hidden" name="revision" value={view.preferences?.revision??""}/><label className="checkbox-label"><input type="checkbox" name="reminders" defaultChecked={view.preferences?.reminders_enabled??true}/>Rappels de disponibilités le dimanche et le lundi</label><label className="checkbox-label"><input type="checkbox" name="push" defaultChecked={view.preferences?.push_enabled??false}/>Autoriser le Push sur mes appareils enregistrés</label><Button disabled={pending}>Enregistrer mes préférences</Button><p role="status">{state.message}</p></form>
    </details><details className="secondary-details"><summary>Mes appareils · {view.subscriptions.length}</summary>{view.subscriptions.length?<ul className="notification-list">{view.subscriptions.map(d=><Device key={`${d.id}-${d.revision}`} device={d}/>)}</ul>:<p>Aucun appareil enregistré.</p>}</details>
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
