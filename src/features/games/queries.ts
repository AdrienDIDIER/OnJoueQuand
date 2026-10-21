import "server-only";
import { requireMember } from "@/features/auth/server";
export async function readGamePreferences(gameId:string, memberIds:string[]) {
  const {client}=await requireMember();
  const {data:game,error}=await client.from("games").select("id,name,archived_at").eq("id",gameId).maybeSingle();
  if(error || !game || game.archived_at) throw new Error("Ce jeu n’est plus disponible. Rechargez la page.");
  const {data,error:failure}=await client.from("game_favorites").select("membership_id").eq("game_id",gameId).in("membership_id",memberIds);
  if(failure) throw new Error("Les favoris sont temporairement indisponibles.");
  return {name:game.name,memberIds:data.map(f=>f.membership_id)};
}
