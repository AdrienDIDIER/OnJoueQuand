import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">ON S’EST PERDUS ?</p><h1>Cette page n’existe pas.</h1><p>Retrouvons-nous à l’accueil.</p><Button asChild><Link href="/accueil">Retour à l’accueil</Link></Button></main>;
}
