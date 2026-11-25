"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function ConfirmDialog({open,title,message,confirmLabel="Eliminar",cancelLabel="Cancelar",onConfirm,onCancel,busy=false}:{open:boolean;title:string;message:ReactNode;confirmLabel?:string;cancelLabel?:string;onConfirm:()=>void;onCancel:()=>void;busy?:boolean}) {
  const titleId=useId();
  const cancelRef=useRef<HTMLButtonElement>(null);
  const onCancelRef=useRef(onCancel);
  useEffect(()=>{onCancelRef.current=onCancel},[onCancel]);
  useEffect(()=>{
    if(!open)return;
    cancelRef.current?.focus();
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      event.preventDefault();
      onCancelRef.current();
    };
    document.addEventListener("keydown",handleKeyDown);
    return()=>document.removeEventListener("keydown",handleKeyDown);
  },[open]);
  if(!open)return null;
  return <div className="modal-backdrop confirm-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}><section className="editor-modal confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}><div className="modal-head"><div><span className="eyebrow">CONFIRMACIÓN</span><h2 id={titleId}>{title}</h2></div><button type="button" aria-label="Cerrar" onClick={onCancel} disabled={busy}>×</button></div><div className="confirm-message">{message}</div><div className="editor-actions"><button ref={cancelRef} type="button" className="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button type="button" className="danger-link confirm-action" onClick={()=>onConfirm()} disabled={busy}>{busy?"Eliminando…":confirmLabel}</button></div></section></div>;
}
