import { z } from "zod";

const httpUrl = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch { return false; }
}, "HTTPS requis hors environnement local.");

const supabaseSchema = z.object({
  url: httpUrl,
  publishableKey: z.string().min(1).refine((value) => {
    if (value.startsWith("sb_publishable_")) return true;
    try {
      const payload = JSON.parse(atob(value.split(".")[1] ?? "")) as { role?: string };
      return payload.role === "anon";
    } catch { return false; }
  }, "Une clé publiable ou anon est requise, jamais une clé secrète."),
});

export function parsePublicEnv(values: Record<string, string | undefined>) {
  const app = httpUrl.safeParse(values.NEXT_PUBLIC_APP_URL);
  if (!app.success) throw new Error("Configuration invalide : NEXT_PUBLIC_APP_URL.");
  const url = values.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) return { appUrl: app.data, supabase: null };
  const result = supabaseSchema.safeParse({ url, publishableKey: key });
  if (!result.success) throw new Error("Configuration Supabase invalide : vérifier les deux variables publiques et utiliser une clé publiable.");
  return { appUrl: app.data, supabase: result.data };
}

export function requireSupabaseConfig(env: ReturnType<typeof parsePublicEnv>) {
  if (!env.supabase) throw new Error("Supabase n’est pas configuré. Renseigner les deux variables publiques avant de connecter les données.");
  return env.supabase;
}
