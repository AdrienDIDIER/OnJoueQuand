import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/server";
import { requireSupabaseConfig } from "@/lib/env/schema";
import type { Database } from "./database.types";

// Exclusivement provisionnement Auth et RPC internes autorisées.
export function adminClient() {
  const config = requireSupabaseConfig(getPublicEnv());
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Configuration serveur indisponible.");
  return createClient<Database>(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
