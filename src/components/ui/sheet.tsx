"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
const CloseSheet=createContext<()=>void>(()=>{});
export function useCloseSheet(){return useContext(CloseSheet);}

export function Sheet({title,trigger,children}:{title:string;trigger:ReactNode;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const triggerButton=useRef<HTMLButtonElement>(null);
  const [opened,setOpened]=useState(false);
  const close=useCallback(()=>dialog.current?.close(),[]);
  return <><button ref={triggerButton} type="button" className="sheet-trigger" aria-label={title} aria-haspopup="dialog" onClick={()=>{setOpened(true);dialog.current?.showModal();}}>{trigger}</button>
    <dialog ref={dialog} className="action-sheet" aria-label={title} onClose={()=>{setOpened(false);triggerButton.current?.focus({preventScroll:true});}} onClick={event=>{if(event.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.current.close();}}}>
      <header><h2>{title}</h2><button type="button" aria-label="Fermer" onClick={()=>dialog.current?.close()}><X size={22} aria-hidden="true"/></button></header>
      {opened&&<CloseSheet value={close}><div className="sheet-body">{children}</div></CloseSheet>}
    </dialog>
  </>;
}
