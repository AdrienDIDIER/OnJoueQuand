import { describe, expect, it } from "vitest";
import { parsePublicEnv, requireSupabaseConfig } from "./schema";

const base = { NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" };

describe("Configuration publique", () => {
  it("autorise le shell sans Supabase mais refuse une utilisation des données", () => {
    const env = parsePublicEnv(base);
    expect(env.supabase).toBeNull();
    expect(() => requireSupabaseConfig(env)).toThrow("Supabase n’est pas configuré");
  });
  it.each([{}, { NEXT_PUBLIC_APP_URL: "not-a-url" }, { NEXT_PUBLIC_APP_URL: "http://example.com" }])("refuse une origine absente ou non sûre : %j", (values) => {
    expect(() => parsePublicEnv(values)).toThrow("NEXT_PUBLIC_APP_URL");
  });
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local" },
  ])("refuse une paire Supabase incomplète : %j", (values) => {
    expect(() => parsePublicEnv({ ...base, ...values })).toThrow("Configuration Supabase invalide");
  });
  it("refuse une clé secrète sans inclure sa valeur dans l’erreur", () => {
    const secret = "sb_secret_ne_pas_afficher";
    const call = () => parsePublicEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(call).toThrow("clé publiable");
    expect(call).not.toThrow(secret);
  });
  it("refuse le rôle service_role d’une ancienne clé JWT", () => {
    const token = `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(() => parsePublicEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: token })).toThrow("Configuration Supabase invalide");
  });
  it("accepte les clés publiables et les anciennes clés anon locales", () => {
    for (const key of ["sb_publishable_local", `header.${btoa(JSON.stringify({ role: "anon" }))}.signature`]) {
      const env = parsePublicEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
      expect(requireSupabaseConfig(env).url).toBe("http://127.0.0.1:54321");
    }
  });
});
