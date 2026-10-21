import "server-only";
import { requireMember } from "@/features/auth/server";
// Contrat public de lecture pour le matching ; aucune écriture hors de ce module.
export async function readAvailabilityPeriod(memberIds:string[], first:string, last:string) {
  const {client}=await requireMember();
  const {data,error}=await client.from("availability_days").select("membership_id,availability_intervals(starts_at,ends_at)").in("membership_id",memberIds).gte("local_date",first).lte("local_date",last).eq("status","available");
  if(error) throw new Error("Les disponibilités sont temporairement indisponibles.");
  return data;
}
