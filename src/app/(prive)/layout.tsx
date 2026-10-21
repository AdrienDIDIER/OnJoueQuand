import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

// Shell sans données privées : il peut s’afficher avant les lectures protégées.
// Chaque page et Server Action vérifie toujours le compte et l’adhésion.
export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
