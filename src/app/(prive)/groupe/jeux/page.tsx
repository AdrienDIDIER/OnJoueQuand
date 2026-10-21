import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/features/auth/server";
import { loadGames } from "@/features/games/server";
import { Catalog } from "@/features/games/ui/catalog";

export default async function GamesPage() {
  const {member}=await requireMember();
  const catalog=await loadGames();
  return <div className="group-page"><Link className="back-link" href="/groupe">← Groupe</Link><h1>À quoi on joue ?</h1><Catalog games={catalog.games} memberId={member.id} admin={member.role==="admin"} requestId={randomUUID()}/></div>;
}
