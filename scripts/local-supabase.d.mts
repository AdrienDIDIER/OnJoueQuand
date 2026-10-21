import type { SupabaseClient } from "@supabase/supabase-js";
export type LocalConfig = { url: string; key: string; secret: string; mailUrl: string };
export function localConfig(): LocalConfig;
export function clients(config?: LocalConfig): { config: LocalConfig; admin: SupabaseClient; anonymous: () => SupabaseClient };
export function checked<R extends { data: unknown; error: unknown }>(result: R): NonNullable<Extract<R, { error: null }>["data"]>;
export function mailboxCode(mailUrl: string, email: string): Promise<string>;
