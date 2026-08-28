"use client";

import { useEffect, useState } from "react";

type Row=Record<string,unknown>;

function valueFor(person:Row,checkpoints:Row[],day:number,key:"weight"|"adherence"){
  if(day===0)return key==="weight"?person.weight:0;
  if(key==="weight")return checkpoints.find(row=>Number(row.day)===day)?.weight??person[`weight_day_${day}`];
  return person[`adherence_day_${day}`];
}

export function ProgressMilestones({person,checkpoints=[],currentDay=90,editable=false,act}:{person:Row;checkpoints?:Row[];currentDay?:number;editable?:boolean;act?:(payload:Row)=>Promise<unknown>}){
  const [drafts,setDrafts]=useState<Record<number,string>>({});
  const weight30=valueFor(person,checkpoints,30,"weight"),weight60=valueFor(person,checkpoints,60,"weight"),weight90=valueFor(person,checkpoints,90,"weight");
  useEffect(()=>{setDrafts({30:String(weight30??""),60:String(weight60??""),90:String(weight90??"")});},[weight30,weight60,weight90]);
  return <section className="milestone-panel"><header><div><span className="eyebrow">HITOS DEL PROCESO</span><h2>Peso y adherencia</h2><p>Una fotografía comparable de tu avance al inicio y en los días 30, 60 y 90.</p></div><span className="milestone-formula">Adherencia: 40% entreno · 40% macros · 20% agua</span></header><div className="milestone-grid">{[0,30,60,90].map(day=>{const unlocked=day===0||currentDay>=day,weight=valueFor(person,checkpoints,day,"weight"),adherence=valueFor(person,checkpoints,day,"adherence");return <article key={day} className={unlocked?"unlocked":"locked"}><div className="milestone-day"><span>{day===0?"INICIO":`DÍA ${day}`}</span><i>{unlocked?"✓":"○"}</i></div><div className="milestone-values"><span><small>Peso</small>{editable&&day>0&&unlocked?<label><input aria-label={`Peso día ${day}`} type="number" min="30" max="300" step="0.1" value={drafts[day]||""} placeholder="kg" onChange={event=>setDrafts({...drafts,[day]:event.target.value})}/><em>kg</em></label>:<b>{weight?`${Number(weight).toFixed(1).replace(".0","")} kg`:unlocked?"Pendiente":"—"}</b>}</span><span><small>Adherencia</small><b>{unlocked&&adherence!=null?`${Math.round(Number(adherence))}%`:"—"}</b></span></div>{editable&&day>0&&unlocked&&<button className="milestone-save" disabled={!drafts[day]} onClick={()=>act?.({action:"checkpoint.self.save",day,weight:drafts[day]})}>{weight?"Actualizar peso":"Guardar peso"}</button>}{!unlocked&&<small className="milestone-locked">Disponible al llegar al día {day}</small>}</article>})}</div></section>;
}
