import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env/server";
import { requireSupabaseConfig } from "@/lib/env/schema";
import type { Database } from "./database.types";

export async function userClient() {
  const config = requireSupabaseConfig(getPublicEnv());
  const jar = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Les lectures Server Component ne peuvent pas écrire ; proxy.ts rafraîchit.
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Écriture possible uniquement dans une action ou le proxy. */ }
      },
    },
  });
}
