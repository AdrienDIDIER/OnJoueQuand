"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/accueil", label: "Accueil", icon: House },
  { href: "/dispos", label: "Dispos", icon: CalendarDays },
  { href: "/sessions", label: "Sessions", icon: Swords },
  { href: "/groupe", label: "Groupe", icon: Users },
];

export function AppNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Navigation principale" className="app-nav">
    {items.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("nav-item", active && "nav-active")}>
        <Icon size={20} aria-hidden="true" /><span>{label}</span><span className="nav-indicator" aria-hidden="true" />
      </Link>;
    })}
  </nav>;
}
