import "server-only";
import { requireMember } from "@/features/auth/server";
export async function loadGameChoices() {
  const {client}=await requireMember();
  const {data,error}=await client.from("games").select("id,name").is("archived_at",null).order("name");
  if(error)throw new Error("Les jeux sont temporairement indisponibles.");
  return data;
}
export async function loadGames() {
  const { client, member } = await requireMember();
  const [games,favorites,members] = await Promise.all([
    client.from("games").select("*").order("created_at"), client.from("game_favorites").select("game_id,membership_id"),
    client.from("memberships").select("id").eq("status","active"),
  ]);
  if(games.error || favorites.error || members.error) throw new Error("Le catalogue est temporairement indisponible.");
  const active=new Set(members.data.map(m=>m.id));
  return { member, games:games.data.map(g=>({ ...g, favorite:favorites.data.some(f=>f.game_id===g.id && f.membership_id===member.id), favoriteCount:favorites.data.filter(f=>f.game_id===g.id && active.has(f.membership_id)).length })) };
}
