"use server";
import { z } from "zod";
import { requireMember } from "@/features/auth/server";
import { readAvailabilityPeriod } from "@/features/availability/queries";
import { readGamePreferences } from "@/features/games/queries";
import { date,addDays,localInstant,monday,today,localParts,dayLabel } from "@/lib/time/paris";
import { readConfirmedCommitments } from "./infrastructure/commitments";
import { findMatches } from "./domain";
export type SearchState = {message:string;results?:{key:string;day:string;label:string;names:string[];favoriteCount:number}[];gameName?:string};
const schema=z.object({first:z.string(),last:z.string(),minimum:z.coerce.number().int().positive(),duration:z.coerce.number().int().positive().multipleOf(15),gameId:z.union([z.string().uuid(),z.literal("")]),members:z.array(z.string().uuid()).min(1)});
export async function searchMatches(_state:SearchState,form:FormData):Promise<SearchState> {
  const {client}=await requireMember();
  const parsed=schema.safeParse({...Object.fromEntries(form),members:form.getAll("members")});
  if(!parsed.success) return {message:"Choisissez une période, au moins un membre, une durée par pas de quinze minutes et un nombre de joueurs positif."};
  try {
    const input=parsed.data; date(input.first); date(input.last);
    const now=new Date().toISOString(); const current=monday(today(now));
    if(input.first<current || input.last>addDays(current,27) || input.first>input.last) throw new Error("La recherche porte sur la semaine courante et les trois suivantes.");
    const selected=[...new Set(input.members)];
    if(selected.length!==input.members.length || input.minimum>selected.length) throw new Error("Le nombre minimum de joueurs dépasse votre sélection.");
    const {data:members,error}=await client.from("memberships").select("id,user_id").eq("status","active").in("id",selected);
    if(error || members.length!==selected.length) throw new Error("La liste des membres a changé. Rechargez la page.");
    const {data:profiles,error:profileError}=await client.from("profiles").select("user_id,display_name").in("user_id",members.map(m=>m.user_id));
    if(profileError) throw new Error("Le groupe est temporairement indisponible.");
    const starts_at=localInstant(input.first,"00:00"), ends_at=localInstant(addDays(input.last,1),"00:00");
    const [availability,preferences,busy]=await Promise.all([
      readAvailabilityPeriod(selected,input.first,input.last),
      input.gameId ? readGamePreferences(input.gameId,selected) : Promise.resolve({name:undefined,memberIds:[] as string[]}),
      readConfirmedCommitments({memberIds:selected,starts_at,ends_at}),
    ]);
    const favorites=new Set(preferences.memberIds);
    const matches=findMatches({starts_at,ends_at,now,minimum:input.minimum,durationMinutes:input.duration,members:members.map(m=>({id:m.id,favorite:favorites.has(m.id),busy:busy[m.id] ?? [],availability:availability.filter(d=>d.membership_id===m.id).flatMap(d=>d.availability_intervals)}))});
    const results=matches.map(c=>{
      const a=localParts(c.starts_at),b=localParts(c.ends_at);
      const offsets=a.occurrence||b.occurrence||a.offset!==b.offset ? ` (UTC${a.offset} → UTC${b.offset})` : "";
      return {key:c.starts_at,day:a.date,label:`${dayLabel(a.date)} · ${a.time}–${a.date===b.date ? b.time : `${dayLabel(b.date)} à ${b.time}`}${offsets}`,names:c.memberIds.map(id=>{const m=members.find(m=>m.id===id)!; return profiles.find(p=>p.user_id===m.user_id)?.display_name ?? "Membre";}),favoriteCount:c.favoriteCount};
    });
    return {message:results.length ? `${results.length} créneau${results.length>1?"x":""} proposé${results.length>1?"s":""}. Classement par nombre de joueurs${preferences.name?", puis favoris du jeu choisi":""}, puis horaire.` : "Aucun créneau commun ne respecte ces critères. Essayez une durée plus courte, une autre période ou un autre seuil.",results,gameName:preferences.name};
  } catch(error) { return {message:error instanceof Error && error.constructor===Error ? error.message : "Recherche impossible. Vérifiez les critères puis réessayez."}; }
}
