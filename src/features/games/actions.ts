"use server";
import { z } from "zod";
import {revalidatePrivateViews} from "@/lib/navigation/revalidate";
import { requireMember } from "@/features/auth/server";
import { gameSchema } from "./domain";
export type GameState = { message:string };
const conflict = {message:"Opération refusée. Le jeu a changé, est archivé ou vos droits ne permettent pas cette modification. Rechargez la page."};
function updated() { revalidatePrivateViews(); }
export async function createGame(_state:GameState,form:FormData):Promise<GameState> {
  const {client}=await requireMember();
  const input=gameSchema.safeParse(Object.fromEntries(form)); const request=z.string().uuid().safeParse(form.get("requestId"));
  if(!input.success || !request.success) return {message:"Choisissez un nom de 1 à 80 caractères et une description de 1 000 caractères au plus."};
  const {error}=await client.rpc("create_game",{game_name:input.data.name,game_description:input.data.description,request_id:request.data});
  if(error) return conflict;
  updated(); return {message:"Jeu ajouté au catalogue."};
}
export async function updateGame(_state:GameState,form:FormData):Promise<GameState> {
  const {client}=await requireMember();
  const input=gameSchema.extend({id:z.string().uuid(),revision:z.coerce.number().int().positive()}).safeParse(Object.fromEntries(form));
  if(!input.success) return {message:"Vérifiez le nom et la description du jeu."};
  const {id,revision,name,description}=input.data;
  const {error}=await client.rpc("update_game",{target_id:id,expected_revision:revision,game_name:name,game_description:description});
  if(error) return conflict;
  updated(); return {message:"Jeu mis à jour."};
}
export async function archiveGame(_state:GameState,form:FormData):Promise<GameState> {
  const {client}=await requireMember();
  const input=z.object({id:z.string().uuid(),revision:z.coerce.number().int().positive()}).safeParse(Object.fromEntries(form));
  if(!input.success) return conflict;
  const {error}=await client.rpc("archive_game",{target_id:input.data.id,expected_revision:input.data.revision});
  if(error) return conflict;
  updated(); return {message:"Jeu archivé. Son historique est conservé."};
}
export async function setFavorite(_state:GameState,form:FormData):Promise<GameState> {
  const {client}=await requireMember();
  const input=z.object({id:z.string().uuid(),expectedFavorite:z.enum(["true","false"])}).safeParse(Object.fromEntries(form));
  if(!input.success) return conflict;
  const expected=input.data.expectedFavorite==="true";
  const {error}=await client.rpc("set_game_favorite",{target_id:input.data.id,expected_favorite:expected,favorite:!expected});
  if(error) return conflict;
  updated(); return {message:expected ? "Jeu retiré de vos favoris." : "Jeu ajouté à vos favoris."};
}
