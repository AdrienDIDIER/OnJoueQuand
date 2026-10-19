import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Dispos" };
export default function Page() {
  return <ComingSoon title="Vos disponibilités" subtitle="Un moment pour vous. Un créneau pour tout le monde." icon="calendar" headline="La bonne soirée commence par une dispo." description="Vous pourrez bientôt indiquer vos soirs libres et découvrir les créneaux qui réunissent votre groupe." details={["Une réponse rapide ou des horaires précis", "La semaine du groupe en un coup d’œil", "Vos disponibilités copiées d’une semaine à l’autre"]} />;
}
