"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/features/auth/server";
import { prepareProposal } from "./domain";
export type SessionActionState={message:string;done?:boolean};
function refreshed() {revalidatePath("/sessions");revalidatePath("/accueil");revalidatePath("/dispos");}
function failure(error:unknown):SessionActionState {return{message:error instanceof Error && error.constructor===Error ? error.message : "Vérifiez le titre, les horaires et l’échéance de la proposition."};}
export async function saveProposal(_state:SessionActionState,form:FormData):Promise<SessionActionState> {
  const {client}=await requireMember();
  try {
    const {data:clock,error}=await client.rpc("session_clock");if(error) throw new Error("La session ne peut pas être enregistrée pour le moment.");
    const proposal=prepareProposal({...Object.fromEntries(form),slots:JSON.parse(String(form.get("slots")))},clock);
    const target=z.string().uuid().optional().parse(form.get("id")||undefined);
    const revision=z.coerce.number().int().positive().optional().parse(form.get("revision")||undefined);
    const result=target ? await client.rpc("session_command",{target_id:target,command:"update",expected_revision:revision!,payload:proposal}) :
      await client.rpc("create_session",{session_title:proposal.title,session_description:proposal.description,selected_game:proposal.game_id!,player_threshold:proposal.minimum_players,candidate_slots:proposal.slots,deadline:proposal.vote_deadline!,request_id:z.string().uuid().parse(form.get("requestId"))});
    if(result.error) return{message:"Enregistrement refusé. Le brouillon a changé, le jeu est archivé ou les horaires ne sont plus valides. Rechargez la page."};
    refreshed();return{message:"Brouillon enregistré. Publiez-le quand les créneaux vous conviennent.",done:true};
  } catch(error) {return failure(error);}
}
const mutation=z.object({id:z.string().uuid(),revision:z.coerce.number().int().positive(),command:z.enum(["publish","close","confirm","cancel","vote","rsvp"])});
export async function changeSession(_state:SessionActionState,form:FormData):Promise<SessionActionState> {
  const {client}=await requireMember();
  const parsed=mutation.safeParse(Object.fromEntries(form));
  if(!parsed.success) return{message:"Commande invalide. Rechargez la page."};
  try {
    const {id,revision,command}=parsed.data;
    let payload:Record<string,string|string[]|number|null>={};
    if(command==="vote") payload={choices:z.array(z.string().uuid()).max(6).parse(form.getAll("choices")),expected_ballot_revision:z.coerce.number().int().positive().nullable().parse(form.get("ballotRevision")?Number(form.get("ballotRevision")):null)};
    if(command==="confirm") payload={slot_id:z.string().uuid().parse(form.get("slotId"))};
    if(command==="rsvp") payload={response:z.enum(["attending","declined"]).parse(form.get("response")),expected_rsvp_revision:z.coerce.number().int().positive().nullable().parse(form.get("rsvpRevision")?Number(form.get("rsvpRevision")):null)};
    const {error}=await client.rpc("session_command",{target_id:id,expected_revision:revision,command,payload});
    if(error) return{message:command==="rsvp" ? "Réponse refusée : un autre engagement chevauche ce créneau, la session a commencé ou vos données ont changé. Rechargez puis réessayez." : "Opération refusée : la proposition a changé, l’échéance est passée ou vos droits ne permettent pas cette action. Rechargez la page."};
    refreshed();return{message:command==="vote"?"Bulletin enregistré.":command==="rsvp"?"Participation enregistrée.":"Session mise à jour.",done:true};
  } catch {return{message:"Saisie invalide. Rechargez puis réessayez."};}
}
