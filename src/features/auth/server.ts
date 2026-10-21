import "server-only";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/server";

export async function requireAccount() {
  if (!getPublicEnv().supabase) redirect("/connexion");
  const client = await userClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/connexion");
  return { client, user };
}

// À appeler pour chaque lecture/mutation protégée, pas seulement dans le layout.
export async function requireMember() {
  const { client, user } = await requireAccount();
  const { data: member } = await client.from("memberships").select("*").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) redirect("/rejoindre");
  return { client, user, member };
}
