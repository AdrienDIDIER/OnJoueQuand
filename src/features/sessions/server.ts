import "server-only";
import { requireMember } from "@/features/auth/server";
import { effectiveStatus,type SessionStatus } from "./domain";
export async function loadSessions(page=0) {
  const {client,member}=await requireMember();
  const [clock,sessions,members,profiles,games]=await Promise.all([
    client.rpc("session_clock"),
    client.from("sessions").select("*,slots:session_slots!session_slots_parent(*),ballots:session_ballots!ballots_parent(*,votes:session_votes!votes_ballot(slot_id)),rsvps:session_rsvps!rsvps_parent(*)").order("created_at",{ascending:false}).range(page*20,page*20+19),
    client.from("memberships").select("id,user_id,status,participation_epoch"),
    client.from("profiles").select("user_id,display_name"),client.from("games").select("id,name,archived_at"),
  ]);
  if(clock.error||sessions.error||members.error||profiles.error||games.error) throw new Error("Les sessions sont temporairement indisponibles.");
  const people=members.data.map(m=>({...m,name:profiles.data.find(p=>p.user_id===m.user_id)?.display_name??"Membre"}));
  const active=new Set(people.filter(m=>m.status==="active").map(m=>m.id));
  return {now:clock.data,member,people,games:games.data,sessions:sessions.data.map(s=>({
    ...s,status:effectiveStatus(s.status as SessionStatus,s.vote_deadline,s.slots,s.confirmed_slot_id,clock.data),
    slots:[...s.slots].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),
    gameName:games.data.find(g=>g.id===s.game_id)?.name,
    creator:people.find(p=>p.id===s.created_by)?.name??"Membre",
    canManage:s.created_by===member.id||member.role==="admin",
    ownBallot:s.ballots.find(b=>b.membership_id===member.id),ownRsvp:s.rsvps.find(r=>r.membership_id===member.id),
    support:s.slots.map(slot=>({id:slot.id,count:s.ballots.filter(b=>active.has(b.membership_id)&&b.votes.some(v=>v.slot_id===slot.id)).length})),
  }))};
}
export type SessionsView = Awaited<ReturnType<typeof loadSessions>>;
export type SessionView = SessionsView["sessions"][number];
