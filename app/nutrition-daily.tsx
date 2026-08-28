"use client";

import { useEffect, useMemo, useState } from "react";

type Row=Record<string,unknown>;
type Values={calories:string;protein:string;fats:string;carbs:string};
const metrics=[{key:"calories",label:"Calorías",unit:"kcal"},{key:"protein",label:"Proteínas",unit:"g"},{key:"fats",label:"Grasas",unit:"g"},{key:"carbs",label:"Carbohidratos",unit:"g"}] as const;
const dayNames=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const iso=(date:Date)=>date.toISOString().slice(0,10);
const dateAt=(value:unknown)=>{const raw=String(value||new Date().toISOString()).slice(0,10);return new Date(`${raw}T12:00:00Z`)};
const addDays=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);
const initialWeek=(start:Date)=>Math.max(1,Math.min(13,Math.floor((Date.now()-start.getTime())/(7*86400000))+1));
const empty=():Values=>({calories:"",protein:"",fats:"",carbs:""});
function tone(value:string,target:number){const actual=Number(value);if(!value||!target)return "";const deviation=Math.abs(actual-target)/target;return deviation<=.1?"green":deviation<=.2?"yellow":"red"}
function recordValues(row?:Row):Values{return {calories:String(row?.calories??""),protein:String(row?.protein??""),fats:String(row?.fats??""),carbs:String(row?.carbs??"")}}

export function NutritionDailyTracker({records,plan,startDate,act}:{records:Row[];plan?:Row|null;startDate:unknown;act:(payload:Row)=>Promise<unknown>}){
  const start=useMemo(()=>dateAt(startDate),[startDate]);const [week,setWeek]=useState(()=>initialWeek(start));
  const days=useMemo(()=>Array.from({length:7},(_,index)=>addDays(start,(week-1)*7+index)).filter(day=>day<addDays(start,90)),[start,week]);
  const [values,setValues]=useState<Record<string,Values>>({});const [saving,setSaving]=useState(false);
  useEffect(()=>{const next:Record<string,Values>={};for(const day of days){const date=iso(day);next[date]=recordValues(records.find(row=>String(row.log_date)===date))}setValues(next)},[records,days]);
  const target=(key:typeof metrics[number]["key"])=>Number(plan?.[key]||0);
  async function save(){const entries=days.map(day=>({date:iso(day),...(values[iso(day)]||empty())})).filter(entry=>metrics.every(metric=>entry[metric.key]!==""));if(!entries.length)return;setSaving(true);try{await act({action:"nutrition.daily.save",entries})}finally{setSaving(false)}}
  return <section className="daily-nutrition"><header><div><span className="eyebrow">REGISTRO DIARIO · DÍA 1 AL 90</span><h2>Mis macros reales</h2><p>Ingresa los valores que obtuviste en tu aplicación de registro. Verde: ±10% · Amarillo: 10–20% · Rojo: más de 20%.</p></div><label>Semana<select value={week} onChange={event=>setWeek(Number(event.target.value))}>{Array.from({length:13},(_,index)=><option value={index+1} key={index}>Semana {index+1}</option>)}</select></label></header>
    {!plan?<div className="professional-file-empty"><b>Objetivos aún no aprobados</b><p>Podrás comparar tus registros cuando la nutricionista publique el plan.</p></div>:<><div className="daily-nutrition-wrap"><table><thead><tr><th>Objetivo</th>{days.map(day=><th key={iso(day)}><b>{dayNames[day.getUTCDay()]}</b><small>{day.toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",timeZone:"UTC"})}</small></th>)}</tr></thead><tbody>{metrics.map(metric=><tr key={metric.key}><th><b>{metric.label}</b><small>{target(metric.key)} {metric.unit}/día</small></th>{days.map(day=>{const date=iso(day),disabled=date>new Date().toISOString().slice(0,10);return <td key={date}><input aria-label={`${metric.label} ${date}`} type="number" min="0" step="0.1" disabled={disabled} className={tone(values[date]?.[metric.key]||"",target(metric.key))} value={values[date]?.[metric.key]||""} onChange={event=>setValues(current=>({...current,[date]:{...(current[date]||empty()),[metric.key]:event.target.value}}))}/></td>})}</tr>)}</tbody></table></div><footer><span>Los días futuros se habilitan automáticamente.</span><button className="primary" disabled={saving} onClick={save}>{saving?"Guardando…":"Guardar semana"}</button></footer></>}
  </section>;
}

export function NutritionDailyReview({records,person}:{records:Row[];person:Row}){
  const start=useMemo(()=>dateAt(person.assigned_at||person.created_at),[person.assigned_at,person.created_at]);const [week,setWeek]=useState(()=>initialWeek(start));
  const days=useMemo(()=>Array.from({length:7},(_,index)=>addDays(start,(week-1)*7+index)).filter(day=>day<addDays(start,90)),[start,week]);
  const own=records.filter(row=>String(row.user_id)===String(person.id));
  const target=(key:typeof metrics[number]["key"])=>Number(person[key]||0),entry=(date:string)=>own.find(row=>String(row.log_date)===date);
  const closure=(date:string)=>{const row=entry(date),calories=Number(row?.calories||0),protein=Number(row?.protein||0),targetCalories=target("calories"),targetProtein=target("protein");if(!row||!targetCalories||!targetProtein)return "empty";return calories>targetCalories*1.1||protein<targetProtein*.9?"missed":"met"};
  return <section className="daily-nutrition review"><header><div><span className="eyebrow">SEGUIMIENTO SEMANAL</span><h3>Cierre diario de macros</h3><p>Primero ves si cumplió; debajo está el detalle de cada valor y su porcentaje respecto al objetivo.</p></div><label>Semana<select value={week} onChange={event=>setWeek(Number(event.target.value))}>{Array.from({length:13},(_,index)=><option value={index+1} key={index}>Semana {index+1}</option>)}</select></label></header><div className="macro-closure-grid">{days.map(day=>{const status=closure(iso(day));return <article className={status} key={iso(day)}><small>{dayNames[day.getUTCDay()]} · {day.toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",timeZone:"UTC"})}</small><strong>{status==="met"?"✓":status==="missed"?"×":"·"}</strong><b>{status==="met"?"Cumplió":status==="missed"?"No cumplió":"Sin registrar"}</b></article>})}</div><div className="daily-nutrition-wrap"><table><thead><tr><th>Objetivo</th>{days.map(day=><th key={iso(day)}><b>{dayNames[day.getUTCDay()]}</b><small>{day.toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",timeZone:"UTC"})}</small></th>)}</tr></thead><tbody>{metrics.map(metric=><tr key={metric.key}><th><b>{metric.label}</b><small>{target(metric.key)} {metric.unit}</small></th>{days.map(day=>{const value=String(entry(iso(day))?.[metric.key]??""),percentage=value&&target(metric.key)?Math.round(Number(value)/target(metric.key)*100):null;return <td key={iso(day)}><span className={`daily-value ${tone(value,target(metric.key))}`}><b>{value||"—"}</b>{percentage!=null&&<small>{percentage}% del objetivo</small>}</span></td>})}</tr>)}</tbody></table></div></section>;
}
