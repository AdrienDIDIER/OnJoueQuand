"use client";
import {RefreshCw} from "lucide-react";

export function RefreshButton() {
  return <button className="refresh-button" type="button" aria-label="Actualiser les informations du groupe" title="Actualiser" onClick={()=>window.dispatchEvent(new Event("ojq:refresh"))}><RefreshCw size={18} aria-hidden="true"/></button>;
}
