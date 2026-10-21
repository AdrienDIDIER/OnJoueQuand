import { clients, checked } from "./local-supabase.mjs";
const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_NAME?.trim();
if (!email?.endsWith("@example.test") || !name || name.length > 60) throw new Error("Définir BOOTSTRAP_EMAIL en @example.test et BOOTSTRAP_NAME (1 à 60 caractères). Usage local uniquement.");
const { admin } = clients();
const created = await admin.auth.admin.createUser({ email, email_confirm: false });
let user = created.data.user;
if (!user) {
  const listed = checked(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }));
  user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
}
if (!user) throw new Error("Impossible de provisionner le compte local.");
checked(await admin.rpc("bootstrap_admin", { account_id: user.id, display_name: name }));
console.log("Administrateur local initialisé. Demandez votre code depuis la page de connexion.");
