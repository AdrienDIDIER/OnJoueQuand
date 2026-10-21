import type { Metadata,Viewport } from "next";
import { getPublicEnv } from "@/lib/env/server";
import {InstallationProvider} from "@/features/pwa/ui/installation";
import "./globals.css";
import "./everyday.css";

// Une page dépend de la session et de la configuration serveur à chaque requête.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "OnJoueQuand — Les bons moments, ensemble", template: "%s · OnJoueQuand" },
  description: "Votre espace privé pour trouver le bon moment et jouer ensemble.",
  robots: { index: false, follow: false },
  applicationName:"OnJoueQuand",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"OnJoueQuand",statusBarStyle:"black-translucent"},
  icons:{icon:"/icons/icon-192.png",apple:"/icons/apple-touch-icon.png"},
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#1b1c19",viewportFit:"cover"};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  getPublicEnv();
  return <html lang="fr" className="dark"><body><InstallationProvider>{children}</InstallationProvider></body></html>;
}
