import { instantMillis } from "../../../lib/time/paris";
import { pushOutcome,subscriptionSchema } from "../domain";
export type Delivery={endpoint:string;keys:{p256dh:string;auth:string};notification_id:string;expires_at:string;type:string;attempts:number};
export async function deliver(prepared:Delivery,send:(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:string,ttl:number)=>Promise<unknown>,now:string,jitter:number){
  const subscription=subscriptionSchema.safeParse(prepared);
  if(!subscription.success)return{outcome:"failed" as const,error_code:"invalid_endpoint",retry_seconds:1};
  const ttl=Math.min(86400,Math.floor((instantMillis(prepared.expires_at)-instantMillis(now))/1000));
  if(ttl<=0)return{outcome:"skipped" as const,error_code:"expired",retry_seconds:1};
  try{
    await send(subscription.data,JSON.stringify({title:"OnJoueQuand",body:prepared.type==="availability.reminder"?"Pensez à renseigner vos disponibilités.":"Une nouvelle information vous attend dans votre groupe.",tag:`ojq:${prepared.notification_id}`,url:"/accueil#notifications"}),ttl);
    return{outcome:"sent" as const,error_code:null,retry_seconds:1};
  }catch(error){
    const e=error as {statusCode?:number;headers?:Record<string,string>};
    return pushOutcome(e?.statusCode,prepared.attempts,e?.headers?.["retry-after"],now,jitter);
  }
}
