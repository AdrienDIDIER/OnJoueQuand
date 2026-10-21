import type { ReactNode } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { AppNavigation } from "./app-navigation";
import {PwaExperience} from "@/features/pwa/ui/experience";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">
    <a href="#contenu" className="skip-link">Aller au contenu</a>
    <aside className="sidebar">
      <Link href="/accueil" className="brand" aria-label="OnJoueQuand — Accueil">
        <span className="wordmark">on joue quand<span>?</span></span>
      </Link>
      <p className="nav-caption">VOTRE ESPACE</p>
      <AppNavigation />
      <div className="sidebar-note"><LockKeyhole size={17} aria-hidden="true" /><div><p>Entre vous, simplement.</p><span>Un espace pensé pour votre groupe.</span></div></div>
    </aside>
    <div className="workspace">
      <main id="contenu" tabIndex={-1}>{children}<PwaExperience/></main>
    </div>
  </div>;
}
