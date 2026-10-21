import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireMember } from "@/features/auth/server";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireMember();
  return <AppShell>{children}</AppShell>;
}
