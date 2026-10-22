"use client";
import {createContext,useContext,useState,type ReactNode} from "react";
import type {Day} from "./domain";

type Updates={memberId:string;days:ReadonlyMap<string,Day>;commit:(day:Day)=>void};
const Context=createContext<Updates|null>(null);

// Seulement les réponses confirmées de ce compte, en mémoire dans le layout privé.
export function AvailabilityUpdates({memberId,children}:{memberId:string;children:ReactNode}){
  const [days,setDays]=useState<ReadonlyMap<string,Day>>(()=>new Map());
  return <Context value={{memberId,days,commit:day=>setDays(previous=>{
    if((previous.get(day.local_date)?.revision??0)>=(day.revision??0))return previous;
    const next=new Map(previous).set(day.local_date,day);
    if(next.size>56)for(const key of [...next.keys()].sort().slice(0,next.size-56))next.delete(key);
    return next;
  })}}>{children}</Context>;
}
export function useAvailabilityUpdates(){
  const value=useContext(Context);
  if(!value)throw new Error("Contexte de disponibilités absent.");
  return value;
}
export function useLiveDay(day:Day,memberId:string){
  const updates=useAvailabilityUpdates();
  const updated=updates.memberId===memberId?updates.days.get(day.local_date):undefined;
  return updated&&(updated.revision??0)>(day.revision??0)?updated:day;
}
