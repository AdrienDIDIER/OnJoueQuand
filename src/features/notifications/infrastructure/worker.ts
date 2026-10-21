import "server-only";
import webpush from "web-push";
import { adminClient } from "@/lib/supabase/admin";
import { deliver,type Delivery } from "../application/delivery";

export function pushConfiguration(){
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
  if(!publicKey||!privateKey||!subject)return null;
  if(!/^(mailto:[^\s]+@[^\s]+|https:\/\/[^\s]+)$/.test(subject))throw new Error("Configuration Push invalide.");
  return{publicKey,privateKey,subject};
}
export async function runNotificationJob(){
  const client=adminClient();const started=await client.rpc("begin_notification_job");
  if(started.error)throw new Error("Traitement indisponible.");
  if(!started.data)return{busy:true};
  const counts={transitions:0,reminders:0,events:0,sent:0,retried:0,skipped:0,failed:0,push_configured:false};
  try{
    const transition=await client.rpc("advance_sessions",{batch_size:100});if(transition.error)throw new Error("transitions");counts.transitions=transition.data;
    const reminders=await client.rpc("enqueue_availability_reminders");if(reminders.error)throw new Error("reminders");counts.reminders=reminders.data;
    const events=await client.rpc("materialize_notifications",{batch_size:30});if(events.error)throw new Error("outbox");counts.events=events.data;
    const vapid=pushConfiguration();counts.push_configured=!!vapid;
    if(vapid){
      const claims=await client.rpc("claim_notification_deliveries",{batch_size:6});if(claims.error)throw new Error("claims");
      // Six appareils au plus, en deux vagues ; timeout réseau de six secondes par tentative.
      for(let i=0;i<claims.data.length;i+=3){const outcomes=await Promise.allSettled(claims.data.slice(i,i+3).map(async claim=>{
        const prepared=await client.rpc("prepare_notification_delivery",{delivery_id:claim.id,token:claim.lease_token});if(prepared.error)throw new Error("prepare");
        if(!prepared.data){counts.skipped++;return;}
        const result=await deliver(prepared.data as unknown as Delivery,(subscription,payload,ttl)=>webpush.sendNotification(subscription,payload,{vapidDetails:vapid,TTL:ttl,timeout:6000,urgency:"normal"}),new Date().toISOString(),Math.random());
        const finished=await client.rpc("finish_notification_delivery",{delivery_id:claim.id,token:claim.lease_token,...result,error_code:result.error_code??undefined});if(finished.error)throw new Error("ack");
        if(result.outcome==="sent")counts.sent++;else if(result.outcome==="retry")counts.retried++;else if(result.outcome==="failed")counts.failed++;else counts.skipped++;
      }));if(outcomes.some(result=>result.status==="rejected"))throw new Error("delivery");}
    }
    const done=await client.rpc("finish_notification_job",{job_id:started.data,success:true,counts});if(done.error)throw new Error("heartbeat");
    return counts;
  }catch{
    await client.rpc("finish_notification_job",{job_id:started.data,success:false,counts});
    throw new Error("Le traitement des notifications a échoué.");
  }
}
