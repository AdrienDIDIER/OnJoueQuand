"use server";
import {z} from "zod";
import {revalidatePrivateViews} from "@/lib/navigation/revalidate";
import {requireMember} from "@/features/auth/server";
import {endpointSchema,subscriptionSchema} from "./domain";
import {pushConfiguration} from "./infrastructure/worker";
import webpush from "web-push";
export type NotificationState={message:string;done?:boolean;resetDevice?:boolean};
function refresh(){revalidatePrivateViews();}
export async function testDeviceNotification(raw:unknown):Promise<NotificationState>{
  const {client}=await requireMember();
  const endpoint=endpointSchema.safeParse(raw);
  if(!endpoint.success)return{message:"Activez d’abord les notifications sur cet appareil."};
  try{
    const vapid=pushConfiguration();if(!vapid)return{message:"Le Push n’est pas encore configuré par l’administrateur."};
    const reserved=await client.rpc("reserve_push_test",{target_endpoint:endpoint.data});
    if(reserved.error)return{message:"Test indisponible. Rechargez la page puis réessayez."};
    const result=z.object({error:z.string()}).safeParse(reserved.data);
    if(result.success)return{message:result.data.error==="limited"?"Attendez une minute avant de refaire le test.":result.data.error==="disabled"?"Autorisez le Push dans vos préférences avant de tester.":"Activez les notifications sur cet appareil avant de tester."};
    const subscription=subscriptionSchema.extend({id:z.string().uuid(),revision:z.number()}).parse(reserved.data);
    try{
      await webpush.sendNotification(subscription,JSON.stringify({title:"OnJoueQuand",body:"Ça marche ! Votre appareil reçoit les notifications.",tag:"ojq:test",url:"/groupe/reglages"}),{vapidDetails:vapid,TTL:60,timeout:6000,urgency:"high"});
      return{done:true,message:"Test envoyé à cet appareil. Si rien ne s’affiche, vérifiez le mode Concentration et les notifications dans les réglages de l’iPhone."};
    }catch(error){
      const status=(error as {statusCode?:number}).statusCode;
      if(status===404||status===410){await client.rpc("notification_command",{command:"unsubscribe",expected_revision:subscription.revision,payload:{id:subscription.id}});refresh();return{resetDevice:true,message:"Cet abonnement a expiré. Réactivez les notifications sur cet appareil."};}
      return{message:status===401||status===403?"Le service Push refuse l’envoi. L’administrateur doit vérifier la configuration VAPID ; vous pouvez aussi réactiver cet appareil.":"L’envoi a échoué. Réessayez dans une minute."};
    }
  }catch{return{message:"Le test est temporairement indisponible. Réessayez plus tard."};}
}
export async function notificationAction(_state:NotificationState,form:FormData):Promise<NotificationState>{
  const {client}=await requireMember();
  try{
    const command=z.enum(["preferences","read","unsubscribe"]).parse(form.get("command"));
    const expected_revision=form.get("revision")?z.coerce.number().int().positive().parse(form.get("revision")):null;
    const payload=command==="preferences"?{reminders_enabled:form.has("reminders"),push_enabled:form.has("push")}: {id:z.string().uuid().parse(form.get("id"))};
    const {error}=await client.rpc("notification_command",{command,expected_revision:expected_revision!,payload});
    if(error)return{message:"Modification refusée. Vos données ont changé : rechargez la page puis réessayez."};
    refresh();return{message:command==="read"?"Notification marquée comme lue.":command==="unsubscribe"?"Appareil retiré.":"Préférences enregistrées.",done:true};
  }catch{return{message:"Vérifiez votre saisie puis réessayez."};}
}
export async function subscribeDevice(raw:unknown):Promise<NotificationState>{
  const {client}=await requireMember();
  const subscription=subscriptionSchema.safeParse(raw);
  if(!subscription.success)return{message:"Cet abonnement Push ou ce navigateur n’est pas pris en charge."};
  const {data,error}=await client.from("push_subscriptions").select("revision").eq("endpoint",subscription.data.endpoint).maybeSingle();
  if(error)return{message:"Les appareils sont temporairement indisponibles."};
  const result=await client.rpc("notification_command",{command:"subscribe",expected_revision:(data?.revision??null)!,payload:{endpoint:subscription.data.endpoint,...subscription.data.keys}});
  if(result.error)return{message:"Activation refusée. Cet appareil est peut-être lié à un autre compte : désactivez son abonnement dans ce navigateur puis réessayez."};
  refresh();return{message:"Notifications activées sur cet appareil.",done:true};
}
