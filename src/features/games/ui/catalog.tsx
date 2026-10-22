"use client";
import { useActionState, useOptimistic, useState } from "react";
import { Button } from "@/components/ui/button";
import { archiveGame,createGame,setFavorite,updateGame } from "../actions";
type Game = {id:string;name:string;description:string;created_by:string;archived_at:string|null;revision:number;favorite:boolean;favoriteCount:number};
const initial={message:""};
function CreateForm({requestId}:{requestId:string}) {
  const [state,action,pending]=useActionState(createGame,initial);
  return <form action={action} className="form-stack"><input type="hidden" name="requestId" value={requestId} />
    <label>Nom du jeu<input name="name" required maxLength={80} /></label><label>Description du jeu<textarea name="description" maxLength={1000} rows={3} /></label>
    <Button disabled={pending}>Ajouter ce jeu</Button><p role="status">{state.message}</p></form>;
}
function GameCard({game,canEdit}:{game:Game;canEdit:boolean}) {
  const [chosen,choose]=useOptimistic(game.favorite,(_old:boolean,next:boolean)=>next);
  const [favorite,favoriteAction,favoriting]=useActionState(async(previous:typeof initial,form:FormData)=>{choose(!game.favorite);return setFavorite(previous,form);},initial);
  const [saved,save,saving]=useActionState(updateGame,initial);
  const [archived,archive,archiving]=useActionState(archiveGame,initial);
  return <article className="game-card"><h3>{game.name}</h3><p>{game.description || "Aucune description pour le moment."}</p>
    <p>{game.archived_at ? "Archivé · historique conservé" : `${game.favoriteCount} favori${game.favoriteCount>1?"s":""} dans le groupe`}</p>
    {(!game.archived_at || game.favorite) && <form action={favoriteAction}><input type="hidden" name="id" value={game.id} /><input type="hidden" name="expectedFavorite" value={String(game.favorite)} />
      <Button variant="outline" disabled={favoriting} aria-busy={favoriting} aria-pressed={chosen}>{chosen ? "Retirer de mes favoris" : "Ajouter à mes favoris"}</Button><p role="status">{favoriting?"Enregistrement…":favorite.message}</p></form>}
    {canEdit && !game.archived_at && <details><summary>Modifier ou archiver ce jeu</summary>
      <form action={save} className="form-stack"><input type="hidden" name="id" value={game.id} /><input type="hidden" name="revision" value={game.revision} />
        <label>Nouveau nom<input name="name" defaultValue={game.name} required maxLength={80} /></label>
        <label>Nouvelle description<textarea name="description" defaultValue={game.description} maxLength={1000} rows={3} /></label>
        <Button disabled={saving}>Enregistrer le jeu</Button><p role="status">{saved.message}</p></form>
      <form action={archive}><input type="hidden" name="id" value={game.id} /><input type="hidden" name="revision" value={game.revision} />
        <p>Archiver retire le jeu des nouvelles recherches et conserve son historique.</p><Button variant="outline" disabled={archiving}>Archiver ce jeu</Button><p role="status">{archived.message}</p></form>
    </details>}
  </article>;
}
export function Catalog({games,memberId,admin,requestId}:{games:Game[];memberId:string;admin:boolean;requestId:string}) {
  const [showArchived,setShowArchived]=useState(false);
  return <section className="group-card"><h2>Les jeux du groupe</h2><p>Un catalogue partagé. Un favori indique une préférence, sans garantir la possession du jeu.</p>
    <details className="game-create"><summary>Ajouter un jeu personnalisé</summary><CreateForm requestId={requestId} /></details>
    <label className="catalog-toggle"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)} />Afficher aussi les jeux archivés</label>
    {!games.some(g=>showArchived || !g.archived_at) && <p>Aucun jeu pour le moment. Ajoutez le premier jeu de votre groupe.</p>}
    <div className="games-grid">{games.filter(g=>showArchived || !g.archived_at).map(g=><GameCard key={`${g.id}-${g.revision}`} game={g} canEdit={admin || g.created_by===memberId} />)}</div>
  </section>;
}
