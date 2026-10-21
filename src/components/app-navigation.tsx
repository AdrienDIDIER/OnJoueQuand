"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, House, CalendarCheck2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/accueil", label: "Accueil", icon: House },
  { href: "/dispos", label: "Dispos", icon: CalendarDays },
  { href: "/sessions", label: "Sessions", icon: CalendarCheck2 },
  { href: "/groupe", label: "Groupe", icon: Users },
];

function NavigationContent({label,children}:{label:string;children:ReactNode}) {
  const {pending}=useLinkStatus();
  return <span className={cn("nav-content",pending&&"nav-pending")} aria-busy={pending}>{children}<span>{label}</span>{pending&&<span className="sr-only" role="status">Chargement de {label}…</span>}</span>;
}

export function AppNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Navigation principale" className="app-nav">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("nav-item", active && "nav-active")}>
        <NavigationContent label={label}><Icon size={20} aria-hidden="true" /></NavigationContent><span className="nav-indicator" aria-hidden="true" />
      </Link>;
    })}
  </nav>;
}
