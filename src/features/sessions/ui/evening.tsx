"use client";
import {useActionState,useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {useCloseSheet} from "@/components/ui/sheet";
import {addDays,today} from "@/lib/time/paris";
import {organizeEvening,type SessionActionState} from "../actions";
import type {SessionsView} from "../server";

export function EveningForm({games,now,requestId,day}:{games:SessionsView["games"];now:string;requestId:string;day?:string}) {
  const [state,action,pending]=useActionState(organizeEvening,{message:""} as SessionActionState);
  const close=useCloseSheet();
  const [start,setStart]=useState("20:00"),[end,setEnd]=useState("23:00");
  const finish=end||"23:00";
  useEffect(()=>{if(state.done)close();},[state.done,close]);
  return <form action={action} className="form-stack">
    <input type="hidden" name="requestId" value={requestId}/>
    <label>Quel soir ?<input name="day" type="date" required min={today(now)} defaultValue={day??addDays(today(now),1)}/></label>
    <label>On commence à quelle heure ?<input name="start" type="time" step={900} required value={start} onChange={event=>setStart(event.target.value)}/></label>
    <p className="form-hint">Heure de Paris · fin prévue à {finish.replace(":"," h ")}{finish<=start?" le lendemain":""}.</p>
    <details className="secondary-details"><summary>Jeu et détails facultatifs</summary><div className="form-stack">
      <label>Jeu<select name="gameId" defaultValue=""><option value="">On verra ensemble</option>{games.filter(game=>!game.archived_at).map(game=><option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
      <label>Nom de la soirée<input name="title" maxLength={120} placeholder="Soirée entre potes"/></label>
      <label>Fin prévue<input name="end" type="time" step={900} value={end} onChange={event=>setEnd(event.target.value)}/></label>
      <details><summary>En cas de changement d’heure</summary><label>Occurrence du début<select name="startOccurrence"><option value="">Horaire habituel</option><option value="earlier">Première occurrence</option><option value="later">Seconde occurrence</option></select></label><label>Occurrence de la fin<select name="endOccurrence"><option value="">Horaire habituel</option><option value="earlier">Première occurrence</option><option value="later">Seconde occurrence</option></select></label></details>
    </div></details>
    <Button disabled={pending} aria-busy={pending}>{pending?"Organisation…":"Organiser la soirée"}</Button><p role="status">{state.message}</p>
  </form>;
}
