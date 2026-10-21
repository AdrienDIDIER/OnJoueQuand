import type { Metadata } from "next";
import { getPublicEnv } from "@/lib/env/server";
import "./globals.css";

// Une page dépend de la session et de la configuration serveur à chaque requête.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "OnJoueQuand — Les bons moments, ensemble", template: "%s · OnJoueQuand" },
  description: "Votre espace privé pour trouver le bon moment et jouer ensemble.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  getPublicEnv();
  return <html lang="fr" className="dark"><body>{children}</body></html>;
}
