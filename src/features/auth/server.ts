import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/server";

const requestClient = cache(async function requestClient() {
  if (!getPublicEnv().supabase) redirect("/connexion");
  return userClient();
});

export const requireAccount = cache(async function requireAccount() {
  const client = await requestClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/connexion");
  return { client, user };
});

// À appeler pour chaque lecture/mutation protégée, pas seulement dans le layout.
// Mémoïsation limitée au rendu courant, jamais partagée entre requêtes/comptes.
export const requireMember = cache(async function requireMember() {
  const client = await requestClient();
  const claims = await client.auth.getClaims();
  const subject = claims.data?.claims.sub;
  if (claims.error || !subject) redirect("/connexion");
  // Le JWT vérifié fournit seulement le sélecteur. Aucun accès positif sans Auth en direct ET RLS.
  const [account, membership] = await Promise.all([
    requireAccount(),
    client.from("memberships").select("*").eq("user_id", subject).eq("status", "active").maybeSingle(),
  ]);
  const {user} = account;
  if (user.id !== subject) redirect("/connexion");
  if (membership.error) throw new Error("Votre groupe est temporairement indisponible. Réessayez dans un instant.");
  const member = membership.data;
  if (!member) redirect("/rejoindre");
  return { client, user, member };
});
