import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireMember } from "@/features/auth/server";
import { navigationAccessKey } from "@/features/navigation/access";
import { NavigationCache } from "@/features/navigation/client";
import {PushInvitation} from "@/features/notifications/ui/push-invitation";

// Premier document : établir le contexte du cache, en plus des contrôles de chaque page/commande.
export default async function Layout({ children }: { children: ReactNode }) {
  const {user,member}=await requireMember();
  return <NavigationCache accessKey={navigationAccessKey(user.id,member)}><AppShell>{children}</AppShell><PushInvitation publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY??""}/></NavigationCache>;
}
