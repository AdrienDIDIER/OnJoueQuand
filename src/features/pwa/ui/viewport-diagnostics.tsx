"use client";

import {useEffect,useState,useSyncExternalStore} from "react";
import {Button} from "@/components/ui/button";

// Géométrie uniquement, en mémoire de cet onglet : aucun compte, URL ou stockage.
const VERSION="affichage-20261022-2";
type Reading={
  etape:string;ms:number;autonome:boolean;ecran:number[];fenetre:number[];
  document:number[];visible:number[]|null;unites:number[];zones:number[];
  navigation:number[]|null;defilement:number[];viewport:string;barreSysteme:string;
};
const empty:readonly Reading[]=[];
let readings:readonly Reading[]=empty;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const snapshot=()=>readings;
const serverSnapshot=()=>empty;
const rounded=(value:number)=>Math.round(value*100)/100;

function measure(etape:string){
  const probe=document.createElement("div");
  probe.style.cssText="position:fixed;visibility:hidden;pointer-events:none;left:0;top:0;width:0;height:100dvh;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box;";
  document.body.append(probe);
  let unites:number[],zones:number[];
  try{
    const style=getComputedStyle(probe);
    zones=[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(value=>parseFloat(value)||0);
    unites=["100vh","100svh","100dvh"].map(height=>{probe.style.height=height;return rounded(probe.getBoundingClientRect().height);});
  }finally{probe.remove();}
  const nav=document.querySelector(".app-nav")?.getBoundingClientRect();
  const visual=window.visualViewport;
  const value:Reading={
    etape,ms:Math.round(performance.now()),
    autonome:matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone,
    ecran:[screen.width,screen.height,window.devicePixelRatio],
    fenetre:[innerWidth,innerHeight],
    document:[document.documentElement.clientWidth,document.documentElement.clientHeight],
    visible:visual?[visual.width,visual.height,visual.offsetTop,visual.offsetLeft,visual.scale].map(rounded):null,
    unites,zones,navigation:nav?[nav.top,nav.bottom,nav.height].map(rounded):null,
    defilement:[scrollX,scrollY].map(rounded),
    viewport:document.querySelector('meta[name="viewport"]')?.getAttribute("content")??"",
    barreSysteme:document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute("content")??"",
  };
  // Conserver le lancement et les neuf relevés les plus récents.
  readings=readings.length<12?[...readings,value]:[...readings.slice(0,3),...readings.slice(-8),value];
  for(const listener of listeners)listener();
}

export function useRecordViewport(){
  useEffect(()=>{
    if(readings.length===0)measure("ouverture");
    let secondFrame=0,scrollFrame=0,resizeTimer:ReturnType<typeof setTimeout>|undefined;
    let resizeCount=0;
    const frame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>measure("premier rendu"));});
    const settled=setTimeout(()=>measure("après 750 ms"),750);
    // Un seul scroll observé : aucun travail à chaque geste pendant l’usage normal.
    const scroll=()=>{scrollFrame=requestAnimationFrame(()=>measure("premier défilement"));};
    const resize=()=>{
      if(resizeCount>=3)return;
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>{resizeCount++;measure("redimensionnement");},150);
    };
    window.addEventListener("scroll",scroll,{passive:true,once:true});
    window.addEventListener("resize",resize);
    window.visualViewport?.addEventListener("resize",resize);
    return()=>{
      cancelAnimationFrame(frame);cancelAnimationFrame(secondFrame);cancelAnimationFrame(scrollFrame);
      clearTimeout(settled);clearTimeout(resizeTimer);
      window.removeEventListener("scroll",scroll);window.removeEventListener("resize",resize);
      window.visualViewport?.removeEventListener("resize",resize);
    };
  },[]);
}

export function ViewportDiagnostics(){
  const values=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
  const [message,setMessage]=useState("");
  const report=JSON.stringify({version:VERSION,releves:values},null,2);
  async function copy(){
    try{await navigator.clipboard.writeText(report);setMessage("Diagnostic copié. Vous pouvez le coller dans la conversation.");}
    catch{setMessage("Sélectionnez le texte du diagnostic pour le copier.");}
  }
  return <details id="diagnostic-affichage" className="group-card disclosure">
    <summary>Aide à l’affichage</summary>
    <div className="disclosure-body form-stack">
      <p>Ces mesures permettent de vérifier la bande vide au lancement. Elles restent sur cet appareil et ne contiennent aucune donnée de compte.</p>
      <p>Fermez puis rouvrez l’application. Si la bande apparaît, faites défiler une fois, puis revenez ici pour copier le diagnostic.</p>
      <Button type="button" variant="outline" onClick={()=>measure("relevé manuel")}>Relever l’affichage actuel</Button>
      <label htmlFor="viewport-report">Diagnostic de l’écran</label>
      <textarea id="viewport-report" readOnly rows={12} value={report} spellCheck={false}/>
      <Button type="button" onClick={copy}>Copier le diagnostic</Button>
      <p role="status">{message}</p>
    </div>
  </details>;
}
