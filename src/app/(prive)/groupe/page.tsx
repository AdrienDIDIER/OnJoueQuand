import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Groupe" };
export default function Page() {
  return <ComingSoon title="Votre groupe" subtitle="Les bonnes personnes font les meilleures parties." icon="group" headline="Votre équipe aura sa place ici." description="Un espace sur invitation pour retrouver vos amis et collègues, partager vos jeux favoris et garder le plaisir de jouer ensemble." details={["Un groupe privé, uniquement sur invitation", "Des profils pour retrouver votre équipe", "Un catalogue de jeux et vos favoris"]} />;
}
