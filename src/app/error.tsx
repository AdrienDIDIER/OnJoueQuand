"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="not-found"><h1>Un imprévu nous interrompt.</h1><p>Réessayez dans un instant.</p><Button onClick={reset}>Réessayer</Button></main>;
}
