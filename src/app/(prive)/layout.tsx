import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireMember } from "@/features/auth/server";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireMember();
  return <AppShell>{children}<form action={signOut} className="signout"><Button variant="outline">Me déconnecter</Button></form></AppShell>;
}
