"use client";

import { useMemo, useState } from "react";

type Row=Record<string,unknown>;
type Guide={days?:Array<{title?:string}>};
const addDays=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);
const dateAt=(value:unknown)=>new Date(`${String(value||new Date().toISOString()).slice(0,10)}T12:00:00Z`);
function parseDays(guideRow?:Row){try{return (JSON.parse(String(guideRow?.content_json||"{}")) as Guide).days||[]}catch{return []}}

export function ParticipantWeekOverview({guideRow,program,workouts=[],sessions,startDate,onOpenTraining,children}:{guideRow?:Row;program?:Row;workouts?:Row[];sessions:Row[];startDate?:unknown;onOpenTraining:()=>void;children:React.ReactNode}){
  const programStart=useMemo(()=>dateAt(startDate),[startDate]);
  const [week,setWeek]=useState(()=>Math.max(1,Math.min(13,Math.floor((Date.now()-programStart.getTime())/(7*86400000))+1)));
  const guideDays=useMemo(()=>parseDays(guideRow),[guideRow]);
  const days=guideDays.length?guideDays:workouts.map((workout,index)=>({title:String(workout.name||`Entrenamiento ${index+1}`)}));
  const from=addDays(programStart,(week-1)*7),to=addDays(from,7);
  const weeklySessions=sessions.filter(item=>{const date=new Date(String(item.starts_at));return date>=from&&date<to});
  return <div className="participant-week"><div className="participant-week-head"><div><span className="eyebrow">SEMANA {week} · PROYECTO 90</span><h1>Tu semana completa</h1><p>Entrenamientos, charlas y sesión individual en un solo lugar.</p></div><label>Semana<select value={week} onChange={event=>setWeek(Number(event.target.value))}>{Array.from({length:13},(_,index)=><option value={index+1} key={index}>Semana {index+1}</option>)}</select></label></div>
    <section className="weekly-training-panel"><header><div><span className="eyebrow">TU RUTINA ASIGNADA</span><h2>{String(program?.name||"Entrenamiento pendiente")}</h2></div>{days.length>0&&<strong>{days.length} días</strong>}</header>{days.length===0?<p className="empty-copy">El coach todavía no asigna una rutina.</p>:<div className="weekly-training-grid">{days.map((day,index)=><button key={`${index}-${day.title}`} onClick={onOpenTraining}><span>DÍA {index+1}</span><b>{String(day.title||`Entrenamiento ${index+1}`).replace(/^[^—]+—\s*/,"")}</b><small>Ver sesión completa →</small></button>)}</div>}</section>
    <div className="participant-week-lower"><section className="weekly-talks"><header><span className="eyebrow">CHARLAS DE LA SEMANA</span><h2>Sesiones del programa</h2></header>{weeklySessions.length===0?<div className="weekly-empty"><span>◇</span><p>No hay charlas programadas esta semana.</p></div>:weeklySessions.map(item=><article key={String(item.id)}><div className="calendar-box"><b>{new Date(String(item.starts_at)).getDate()}</b><span>{new Date(String(item.starts_at)).toLocaleDateString("es-CL",{month:"short"}).toUpperCase()}</span></div><div><h3>{String(item.title)}</h3><p>{new Date(String(item.starts_at)).toLocaleString("es-CL")} · {String(item.professional||"Equipo Proyecto 90")}</p></div>{item.link&&<a className="secondary" href={String(item.link)} target="_blank" rel="noreferrer">Entrar ↗</a>}</article>)}</section>{children}</div>
  </div>;
}
