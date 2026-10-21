"use client";
import { startTransition,useActionState,useState } from "react";
import { Button } from "@/components/ui/button";
import { searchMatches,type SearchState } from "../actions";
export function MatchingSearch({week,last,firstEditable,lastEditable,members,games}:{week:string;last:string;firstEditable:string;lastEditable:string;members:{id:string;name:string}[];games:{id:string;name:string}[]}) {
  const [state,action,pending]=useActionState(searchMatches,{message:""} as SearchState);
  const [dirty,setDirty]=useState(false);
  const [criteria,setCriteria]=useState({first:week,last,minimum:"2",duration:"60",gameId:""});
  const [selected,setSelected]=useState(members.map(m=>m.id));
  return <section className="group-card" id="creneaux-communs"><h2>Trouver un créneau commun</h2><p>Les mêmes joueurs doivent être disponibles pendant toute la durée. Une suggestion reste à discuter avec le groupe.</p>
    <form onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);setDirty(false);startTransition(()=>action(form));}} className="form-stack matching-form" onChange={()=>setDirty(true)}>
      <label>Du<input type="date" name="first" value={criteria.first} onChange={e=>setCriteria({...criteria,first:e.target.value})} min={firstEditable} max={lastEditable} required /></label>
      <label>Au<input type="date" name="last" value={criteria.last} onChange={e=>setCriteria({...criteria,last:e.target.value})} min={firstEditable} max={lastEditable} required /></label>
      <label>Nombre minimum de joueurs<input type="number" name="minimum" value={criteria.minimum} onChange={e=>setCriteria({...criteria,minimum:e.target.value})} min={1} max={Math.max(2,members.length)} required /></label>
      <label>Durée en minutes<input type="number" name="duration" value={criteria.duration} onChange={e=>setCriteria({...criteria,duration:e.target.value})} min={15} step={15} max={40380} required /></label>
      <label>Jeu facultatif<select name="gameId" value={criteria.gameId} onChange={e=>setCriteria({...criteria,gameId:e.target.value})}><option value="">Tous les jeux</option>{games.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <fieldset><legend>Membres recherchés</legend><div className="matching-members">{members.map(m=><label key={m.id}><input type="checkbox" name="members" value={m.id} checked={selected.includes(m.id)} onChange={e=>setSelected(e.target.checked?[...selected,m.id]:selected.filter(id=>id!==m.id))} />{m.name}</label>)}</div></fieldset>
      <Button disabled={pending}>{pending?"Recherche…":"Rechercher des créneaux"}</Button>
    </form>
    {!dirty && !pending && <div aria-live="polite"><p role="status">{state.message}</p>
      {state.gameName && <p>Jeu : {state.gameName}. Un favori indique une préférence, sans garantir la possession du jeu.</p>}
      <ol className="matching-results">{state.results?.map(r=><li key={r.key}><h3>{r.label}</h3><p>{r.names.length} joueur{r.names.length>1?"s":""} disponible{r.names.length>1?"s":""} sur toute la durée{state.gameName?` · ${r.favoriteCount} favori${r.favoriteCount>1?"s":""} pour ce jeu`:""}.</p><p>{r.names.join(", ")}</p></li>)}</ol>
    </div>}
  </section>;
}
