import "server-only";
import {z} from "zod";
import type {requireMember} from "@/features/auth/server";
import {addDays} from "@/lib/time/paris";
import {emptyDay,normalize,savePlan,type Day} from "./domain";

const input=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),revision:z.union([z.null(),z.number().int().positive()]),status:z.enum(["available","unavailable"]),quickStart:z.string().regex(/^\d{2}:\d{2}$/),quickEnd:z.string().regex(/^\d{2}:\d{2}$/)}).strict();
export type QuickReplyResult={done?:boolean;message:string;day?:Day;code?:"context_changed"};

export async function saveQuickAvailability({client,member}:Awaited<ReturnType<typeof requireMember>>,raw:unknown):Promise<QuickReplyResult>{
  const parsed=input.safeParse(raw);
  if(!parsed.success)return{message:"Réponse invalide. Rechargez la page puis réessayez."};
  try{
    const {date,revision,status,quickStart,quickEnd}=parsed.data;
    // Une seule journée et les paramètres communs ; ne plus charger toute la semaine pour un bouton.
    const [saved,group]=await Promise.all([
      client.from("availability_days").select("local_date,status,mode,revision,availability_intervals(starts_at,ends_at)").eq("membership_id",member.id).eq("local_date",date).maybeSingle(),
      client.from("groups").select("quick_start,quick_end").single(),
    ]);
    if(saved.error||group.error)throw new Error("Vos disponibilités sont temporairement indisponibles.");
    const row=saved.data;
    const day:Day=row?{...row,status:row.status as Day["status"],mode:row.mode as Day["mode"],intervals:normalize(row.availability_intervals)}:emptyDay(date);
    if(day.revision!==revision)throw new Error("Disponibilités modifiées. Rechargez la page avant de continuer.");
    if(day.mode==="detailed")throw new Error("Ouvrez les horaires et options pour modifier cette journée détaillée.");
    const quick={start:group.data.quick_start.slice(0,5),end:group.data.quick_end.slice(0,5)};
    if(quickStart!==quick.start||quickEnd!==quick.end)throw new Error("Les horaires rapides ont changé. Rechargez la page avant de continuer.");
    const changes=savePlan(day,emptyDay(addDays(date,1)),status,"quick",[],new Date().toISOString(),quick);
    if(changes.length!==1)throw new Error("Utilisez les horaires détaillés pour une réponse sur plusieurs journées.");
    const {error}=await client.rpc("save_availability",{changes});
    if(error)return{message:"Enregistrement refusé. Rechargez la page pour retrouver vos dernières disponibilités."};
    // La RPC existante crée la révision 1 ou incrémente exactement la révision attendue sous verrou.
    const change=changes[0]!;
    return{done:true,message:"Disponibilités enregistrées.",day:{local_date:date,status:change.status,mode:change.mode,intervals:change.intervals,revision:(revision??0)+1}};
  }catch(error){return{message:error instanceof Error&&error.constructor===Error?error.message:"Saisie invalide. Vérifiez les dates et horaires."};}
}
