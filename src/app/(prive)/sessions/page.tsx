import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Sessions" };
export default function Page() {
  return <ComingSoon title="Vos sessions" subtitle="Des envies de jeu aux rendez-vous qui se concrétisent." icon="sessions" headline="La prochaine partie se prépare ici." description="Proposer un jeu, voter pour un horaire et confirmer sa participation : bientôt, tout se passera au même endroit." details={["Plusieurs créneaux pour une même proposition", "Un vote pour tous les horaires qui vous conviennent", "Une participation confirmée, chacun à son rythme"]} />;
}
