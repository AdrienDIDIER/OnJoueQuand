"use client";
import {RefreshCw} from "lucide-react";
import {useEffect,useState} from "react";

export function RefreshButton() {
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const receive=(event:Event)=>setBusy((event as CustomEvent<unknown>).detail===true);
    window.addEventListener("ojq:refresh-state",receive);
    return()=>window.removeEventListener("ojq:refresh-state",receive);
  },[]);
  return <button className="refresh-button" type="button" aria-label="Actualiser les informations du groupe" aria-busy={busy} disabled={busy} title="Actualiser" onClick={()=>window.dispatchEvent(new Event("ojq:refresh"))}><RefreshCw size={18} aria-hidden="true"/>{busy&&<span className="sr-only" role="status">Actualisation…</span>}</button>;
}
