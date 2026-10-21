import "server-only";
import { requireMember } from "@/features/auth/server";
import { notificationContent } from "./domain";
export async function loadInbox(){
  const {client}=await requireMember();
  const [notes,unread]=await Promise.all([client.from("notifications").select("*").order("created_at",{ascending:false}).limit(20),client.from("notifications").select("id",{count:"exact",head:true}).is("read_at",null)]);
  if(notes.error||unread.error)throw new Error("Les notifications sont temporairement indisponibles.");
  return{unread:unread.count??0,notes:notes.data.map(n=>({...n,...notificationContent(n.type,n.payload,n.resource_id)}))};
}
export async function loadNotificationSettings(){
  const {client,member}=await requireMember();
  const [preferences,subscriptions,status]=await Promise.all([client.from("notification_preferences").select("*").maybeSingle(),client.from("push_subscriptions").select("id,revision,created_at").order("created_at"),member.role==="admin"?client.rpc("notification_job_status"):Promise.resolve({data:null,error:null})]);
  if(preferences.error||subscriptions.error)throw new Error("Les préférences sont temporairement indisponibles.");
  return{preferences:preferences.data,subscriptions:subscriptions.data,status:member.role==="admin"?(status.error?{unavailable:true}:status.data):null,publicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY??""};
}
