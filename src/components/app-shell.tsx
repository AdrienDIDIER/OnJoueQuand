import type { ReactNode } from "react";
import Link from "next/link";
import { Gamepad2, LockKeyhole, Settings } from "lucide-react";
import { AppNavigation } from "./app-navigation";
import {PwaExperience} from "@/features/pwa/ui/experience";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">
    <a href="#contenu" className="skip-link">Aller au contenu</a>
    <aside className="sidebar">
      <Link href="/accueil" className="brand" aria-label="OnJoueQuand — Accueil">
        <span className="brand-icon"><Gamepad2 size={23} aria-hidden="true" /></span>
        <span>OnJoue<span className="text-primary">Quand</span><span className="brand-caption">LES BONS MOMENTS, ENSEMBLE.</span></span>
      </Link>
      <p className="nav-caption">VOTRE ESPACE</p>
      <AppNavigation />
      <div className="sidebar-note"><LockKeyhole size={17} aria-hidden="true" /><div><p>Entre vous, simplement.</p><span>Un espace pensé pour votre groupe.</span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Entre amis, tout simplement.</span><Link href="/groupe/reglages" className="settings-link" aria-label="Mes réglages"><Settings size={20} aria-hidden="true"/></Link></header>
      <main id="contenu" tabIndex={-1}>{children}<PwaExperience/></main>
    </div>
  </div>;
}
