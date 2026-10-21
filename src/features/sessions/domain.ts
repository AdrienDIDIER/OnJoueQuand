import { z } from "zod";
import { addDays,compareInstant,instantISO,instantMillis,localInstant,type Occurrence } from "../../lib/time/paris";
export type SessionStatus = "draft"|"voting"|"closed"|"confirmed"|"completed"|"cancelled"|"expired";
export type Slot = {id:string;starts_at:string;ends_at:string};
export type LocalSlot = {start:string;end:string;startOccurrence?:Occurrence;endOccurrence?:Occurrence};
export const localSlotSchema=z.object({start:z.string(),end:z.string(),startOccurrence:z.enum(["earlier","later"]).optional(),endOccurrence:z.enum(["earlier","later"]).optional()});
export const proposalSchema=z.object({title:z.string().trim().min(1).max(120),description:z.string().trim().max(2000),gameId:z.union([z.string().uuid(),z.literal("")]),minimum:z.coerce.number().int().positive(),slots:z.array(localSlotSchema).min(2).max(6),deadline:z.string(),deadlineOccurrence:z.enum(["earlier","later",""]).optional()});
export function localDateTime(value:string, occurrence?:Occurrence) {
  const match=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if(!match) throw new Error("Vérifiez la date et l’heure de Paris.");
  return localInstant(match[1]!,match[2]!,occurrence);
}
export function prepareEvening(raw:unknown,now:string) {
  const input=z.object({title:z.string().trim().max(120),gameId:z.union([z.string().uuid(),z.literal("")]),day:z.string(),start:z.string(),end:z.string(),startOccurrence:z.enum(["earlier","later",""]).optional(),endOccurrence:z.enum(["earlier","later",""]).optional()}).parse(raw);
  const starts_at=localInstant(input.day,input.start,input.startOccurrence||undefined);
  const end=input.end||"23:00";
  const ends_at=localInstant(end<=input.start?addDays(input.day,1):input.day,end,input.endOccurrence||undefined);
  if(compareInstant(starts_at,now)<=0)throw new Error("Choisissez une soirée future.");
  if(compareInstant(starts_at,ends_at)>=0||instantMillis(ends_at)-instantMillis(starts_at)>25*60*60_000)throw new Error("Vérifiez la fin de la soirée.");
  return{title:input.title||"Soirée entre potes",game_id:input.gameId||null,starts_at,ends_at};
}
export function suggestedDeadline(slots:Pick<Slot,"starts_at">[],now:string) {
  return instantISO(Math.min(instantMillis(now)+48*60*60_000,...slots.map(s=>instantMillis(s.starts_at))));
}
export function prepareProposal(raw:unknown,now:string) {
  const input=proposalSchema.parse(raw);
  const slots=input.slots.map(s=>({starts_at:localDateTime(s.start,s.startOccurrence),ends_at:localDateTime(s.end,s.endOccurrence)}));
  for(const slot of slots) {
    if(compareInstant(slot.starts_at,now)<=0) throw new Error("Choisissez uniquement des créneaux futurs.");
    if(compareInstant(slot.starts_at,slot.ends_at)>=0) throw new Error("La fin doit être après le début.");
  }
  if(new Set(slots.map(s=>`${s.starts_at}/${s.ends_at}`)).size!==slots.length) throw new Error("Les créneaux doivent être distincts.");
  const deadline=input.deadline ? localDateTime(input.deadline,(input.deadlineOccurrence||undefined) as Occurrence) : null;
  if(deadline && (compareInstant(deadline,now)<=0 || slots.some(s=>compareInstant(deadline,s.starts_at)>0))) throw new Error("L’échéance doit être future et ne pas dépasser le premier créneau.");
  return {title:input.title,description:input.description,game_id:input.gameId||null,minimum_players:input.minimum,slots,vote_deadline:deadline};
}
export function effectiveStatus(status:SessionStatus,deadline:string|null,slots:Slot[],confirmedSlotId:string|null,now:string):SessionStatus {
  let phase=status;
  if(phase==="voting" && deadline && compareInstant(now,deadline)>=0) phase="closed";
  if(phase==="closed" && !slots.some(s=>compareInstant(s.starts_at,now)>0)) phase="expired";
  if(phase==="confirmed") {
    const selected=slots.find(s=>s.id===confirmedSlotId);
    if(selected && compareInstant(selected.ends_at,now)<=0) phase="completed";
  }
  return phase;
}
export const statusLabels:Record<SessionStatus,string>={draft:"Brouillon",voting:"Vote ouvert",closed:"Vote clos",confirmed:"Confirmée",completed:"Terminée",cancelled:"Annulée",expired:"Expirée"};
