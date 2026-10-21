import "server-only";
import { requireMember } from "@/features/auth/server";
import { compareInstant } from "@/lib/time/paris";
export async function readConfirmedBusy(memberIds:string[],starts_at:string,ends_at:string) {
  const {client}=await requireMember();
  const {data,error}=await client.rpc("read_confirmed_commitments",{member_ids:memberIds,period_start:starts_at,period_end:ends_at});
  if(error) throw new Error("Les participations confirmées sont temporairement indisponibles.");
  return data;
}
export async function readNextSession() {
  const {client,member}=await requireMember();
  const {data:clock,error:failure}=await client.rpc("session_clock");
  if(failure) throw new Error("Les sessions sont temporairement indisponibles.");
  const {data,error}=await client.from("sessions").select("id,title,confirmed_slot_id,slots:session_slots!session_slots_parent(id,starts_at,ends_at),rsvps:session_rsvps!rsvps_parent(membership_id,response,membership_epoch)").eq("status","confirmed");
  if(error) throw new Error("Les sessions sont temporairement indisponibles.");
  return data.flatMap(s=>{const slot=s.slots.find(x=>x.id===s.confirmed_slot_id);if(!slot||compareInstant(slot.starts_at,clock)<=0)return[];
    const own=s.rsvps.find(r=>r.membership_id===member.id&&r.membership_epoch===member.participation_epoch);
    return[{id:s.id,title:s.title,slot,response:own?.response}];}).sort((a,b)=>compareInstant(a.slot.starts_at,b.slot.starts_at))[0]??null;
}
