import { test as base } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { clients, checked } from "../../scripts/local-supabase.mjs";

export const test = base.extend<{ authCookies: { name: string; value: string; domain: string; path: string }[] }>({
  authCookies: async ({}, provide) => {
    const { admin, config } = clients();
    // Un compte par scénario : un logout ou un nouvel OTP ne révoque pas un test parallèle.
    const account=checked(await admin.auth.admin.createUser({email:`interface-${crypto.randomUUID()}@example.test`,email_confirm:true}));
    const group=checked(await admin.from("groups").select("id").single());
    checked(await admin.from("profiles").insert({user_id:account.user.id,display_name:"Recette interface"}));
    const member=checked(await admin.from("memberships").insert({user_id:account.user.id,group_id:group.id,role:"admin"}).select("id").single());
    const link = checked(await admin.auth.admin.generateLink({ type: "magiclink", email: account.user.email! }));
    const values = new Map<string, string>();
    const client = createServerClient(config.url, config.key, { cookies: {
      getAll: () => [...values].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => values.set(name, value)),
    } });
    checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" }));
    try{await provide([...values].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/" })));}
    finally{
      checked(await admin.from("invitations").delete().eq("invited_by",account.user.id));
      checked(await admin.from("memberships").delete().eq("id",member.id));checked(await admin.from("profiles").delete().eq("user_id",account.user.id));checked(await admin.auth.admin.deleteUser(account.user.id));
    }
  },
  page: async ({ page, authCookies }, provide) => {
    await page.context().addCookies(authCookies);
    await provide(page);
  },
});
