"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireMember} from "@/features/auth/server";
import {subscriptionSchema} from "./domain";
export type NotificationState={message:string;done?:boolean};
function refresh(){revalidatePath("/accueil");revalidatePath("/groupe");}
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
