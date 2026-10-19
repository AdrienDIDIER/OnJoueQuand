import type { ReactNode } from "react";
import Link from "next/link";
import { Gamepad2, LockKeyhole, Sparkles } from "lucide-react";
import { AppNavigation } from "./app-navigation";

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
      <header className="topbar"><span>Un rendez-vous avec votre équipe.</span><span className="status-pill"><Sparkles size={13} aria-hidden="true" />En préparation</span></header>
      <main id="contenu" tabIndex={-1}>{children}</main>
      <footer className="footer"><span>Moins d’organisation. Plus de bons moments.</span><span>Horaires de Paris</span></footer>
    </div>
  </div>;
}
