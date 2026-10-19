import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

// J1 : shell public sans données. Le nom du groupe de routes n'est pas
// une autorisation ; le contrôle Auth/adhésion sera obligatoire en J2.
export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
