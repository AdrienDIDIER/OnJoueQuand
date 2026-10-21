import { test as base } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { clients, checked } from "../../scripts/local-supabase.mjs";

export const test = base.extend<Record<never, never>, { authCookies: { name: string; value: string; domain: string; path: string }[] }>({
  authCookies: [async ({}, provide) => {
    const { admin, config } = clients();
    const member = checked(await admin.from("memberships").select("user_id").eq("role", "admin").eq("status", "active").single());
    const account = checked(await admin.auth.admin.getUserById(member.user_id));
    const link = checked(await admin.auth.admin.generateLink({ type: "magiclink", email: account.user.email! }));
    const values = new Map<string, string>();
    const client = createServerClient(config.url, config.key, { cookies: {
      getAll: () => [...values].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => values.set(name, value)),
    } });
    checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" }));
    await provide([...values].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/" })));
  }, { scope: "worker" }],
  page: async ({ page, authCookies }, provide) => {
    await page.context().addCookies(authCookies);
    await provide(page);
  },
});
