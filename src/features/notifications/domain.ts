import { z } from "zod";
import { addDays,date,instantMillis,localInstant,monday,today } from "../../lib/time/paris";

export const endpointSchema=z.string().min(30).max(2048).regex(/^https:\/\/(?:fcm\.googleapis\.com\/(?:fcm\/send|wp)\/[A-Za-z0-9:_=-]+|updates\.push\.services\.mozilla\.com\/wpush\/v2\/[A-Za-z0-9=_-]+|web\.push\.apple\.com\/[A-Za-z0-9/_=-]+)$/,"Ce fournisseur Push n’est pas pris en charge.");
export const subscriptionSchema=z.object({endpoint:endpointSchema,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export type NotificationKind="session.published"|"session.vote_closed"|"session.confirmed"|"session.cancelled"|"availability.reminder";
export function notificationContent(kind:string,data:unknown,resourceId:string){
  if(kind==="availability.reminder"){
    const parsed=z.object({week:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).safeParse(data);
    const week=parsed.success?parsed.data.week:undefined;
    return{title:"Rappel de disponibilités",body:week?`Semaine du ${date(week).toLocaleString("fr-FR",{day:"numeric",month:"long"})} : consultez vos réponses actuelles.`:"Retrouvez vos disponibilités de la semaine.",url:week?`/dispos?semaine=${week}`:"/dispos"};
  }
  const labels:Record<string,string>={"session.published":"Une proposition de session a été publiée","session.vote_closed":"Un vote s’est terminé","session.confirmed":"Une session a été confirmée","session.cancelled":"Une session a été annulée"};
  return{title:labels[kind]??"Une nouvelle information pour votre groupe",body:"Consultez la session pour retrouver son état actuel.",url:`/sessions#session-${resourceId}`};
}
// Fenêtre métier, calculée en dates civiles de Paris ; aucune horloge globale.
export function reminderWindow(now:string){
  const day=today(now),week=monday(day),millis=instantMillis(now);
  let target=week,stage:"sunday"|"monday"="sunday";
  if(millis>=instantMillis(localInstant(addDays(week,6),"18:00")))target=addDays(week,7);
  else if(millis>=instantMillis(localInstant(week,"18:00")))stage="monday";
  const due=localInstant(addDays(target,stage==="sunday"?-1:0),"18:00"),expires=localInstant(addDays(target,stage==="sunday"?0:1),"18:00");
  return millis>=instantMillis(due)&&millis<instantMillis(expires)?{week:target,stage,due,expires}:null;
}
export function pushOutcome(status:number|undefined,attempt:number,retryAfter:string|undefined,now:string,jitter:number){
  if(status===404||status===410)return{outcome:"gone" as const,error_code:String(status),retry_seconds:1};
  const transient=status===undefined||status===408||status===429||(status>=500&&status<=599);
  if(!transient)return{outcome:"failed" as const,error_code:String(status),retry_seconds:1};
  let delay=60*2**Math.min(Math.max(attempt-1,0),4)+Math.floor(Math.max(0,Math.min(jitter,1))*30);
  if(retryAfter){const seconds=Number(retryAfter);const dateDelay=Date.parse(retryAfter)-instantMillis(now);if(Number.isFinite(seconds)&&seconds>=0)delay=Math.max(delay,seconds);else if(Number.isFinite(dateDelay))delay=Math.max(delay,Math.ceil(dateDelay/1000));}
  return{outcome:"retry" as const,error_code:status?String(status):"network",retry_seconds:Math.min(Math.max(delay,1),86400)};
}
