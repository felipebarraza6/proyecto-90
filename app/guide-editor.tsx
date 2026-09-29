"use client";

import { FormEvent, useMemo, useState } from "react";

type Row=Record<string,unknown>;
type GuideRow={exerciseName?:string;cells?:string[]};
type GuideNode={type?:string;text?:string;name?:string;prescription?:string;rows?:GuideRow[]};
type GuideDay={title?:string;nodes?:GuideNode[]};
type Guide={days?:GuideDay[]};
type Item={locator:string;name:string;prescription:string};

function parseGuide(row:Row):Guide{try{return JSON.parse(String(row.content_json||"{}")) as Guide}catch{return {days:[]}}}
function cleanName(value:string){return value.replace(/^\d+[.)]\s*/,"").replace(/[.]$/,"").trim()}
type TextItem={locator:string;text:string;kind:"heading"|"paragraph"};
function textItemsFor(day?:GuideDay){
  const items:TextItem[]=[];
  for(const [nodeIndex,node] of (day?.nodes||[]).entries()){
    if(node.type==="heading"&&node.text)items.push({locator:`node:${nodeIndex}`,text:node.text,kind:"heading"});
    if(node.type==="paragraph"&&node.text)items.push({locator:`node:${nodeIndex}`,text:node.text,kind:"paragraph"});
  }
  return items;
}
function itemsFor(day?:GuideDay){
  const items:Item[]=[]; let warmup=false;
  for(const [nodeIndex,node] of (day?.nodes||[]).entries()){
    if(node.type==="heading")warmup=/calentamiento/i.test(node.text||"");
    if(warmup&&node.type==="paragraph"&&node.text&&!/(:$|cada ejercicio|cada uno|vueltas?|minutos? continuos|descanso|transici[oó]n)/i.test(node.text))items.push({locator:`node:${nodeIndex}`,name:cleanName(node.text),prescription:node.prescription||"30 s"});
    if((node.type==="exercise"||node.type==="exerciseHeading")&&node.name)items.push({locator:`node:${nodeIndex}`,name:node.name,prescription:node.prescription||""});
    for(const [rowIndex,row] of (node.rows||[]).entries())if(row.exerciseName)items.push({locator:`row:${nodeIndex}:${rowIndex}`,name:row.exerciseName,prescription:row.cells?.[1]||""});
  }
  return items;
}

export function GuideEditor({guideRow,exercises,act}:{guideRow:Row;exercises:Row[];act:(payload:Row)=>Promise<unknown>}){
  const guide=useMemo(()=>parseGuide(guideRow),[guideRow]); const days=guide.days||[];
  const [dayIndex,setDayIndex]=useState(0); const [busy,setBusy]=useState("");
  const items=itemsFor(days[dayIndex]);
  const textItems=textItemsFor(days[dayIndex]);
  const nodeCount=(days[dayIndex]?.nodes||[]).length;
  async function addText(event:FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);const text=String(form.get("text")||"").trim();if(!text)return;const where=String(form.get("position")||"end");const position=where==="end"?nodeCount:where==="start"?0:Number(where);setBusy("text-add");try{await act({action:"program.guide.text.add",programId:guideRow.program_id,dayIndex,kind:String(form.get("kind")||"paragraph"),text,position});formElement.reset()}finally{setBusy("")}}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);setBusy("add");try{await act({action:"program.guide.exercise.add",programId:guideRow.program_id,dayIndex,exerciseId:String(form.get("exerciseId")||""),prescription:String(form.get("prescription")||"")})}finally{setBusy("")}}
  return <section className="guide-editor"><div className="guide-editor-heading"><div><span className="eyebrow">EDITOR DE RUTINA</span><h2>Ejercicios por día</h2><p>Agrega, modifica o retira ejercicios. Los cambios quedan pendientes de aprobación para los alumnos asignados.</p></div></div>
    <div className="guide-day-tabs">{days.map((day,index)=><button key={`${index}-${day.title}`} className={index===dayIndex?"active":""} onClick={()=>setDayIndex(index)}><span>Día {index+1}</span><b>{String(day.title||`Entrenamiento ${index+1}`).replace(/^[^—]+—\s*/,"")}</b></button>)}</div>
    <div className="guide-edit-list">{items.map((item,index)=><GuideItem key={`${item.locator}-${item.name}`} item={item} number={index+1} busy={busy} save={async(name,prescription)=>{setBusy(item.locator);try{await act({action:"program.guide.exercise.update",programId:guideRow.program_id,dayIndex,locator:item.locator,name,prescription})}finally{setBusy("")}}} remove={async()=>{if(!confirm(`¿Retirar ${item.name} de este día?`))return;setBusy(item.locator);try{await act({action:"program.guide.exercise.remove",programId:guideRow.program_id,dayIndex,locator:item.locator})}finally{setBusy("")}}}/>)}</div>
    <div className="guide-texts-block"><div className="guide-editor-heading"><span className="eyebrow">TEXTOS E INDICACIONES DEL DÍA</span><h3>Titulares y notas de la rutina</h3><p>Los textos que ve el alumno (títulos de bloque, duraciones, descansos, notas) se agregan, editan o retiran aquí.</p></div><div className="guide-text-list">{textItems.length===0?<p className="empty-copy">Este día no tiene textos adicionales.</p>:textItems.map(item=><GuideTextItem key={`${item.locator}-${item.text}`} item={item} busy={busy} save={async(text)=>{setBusy(item.locator);try{await act({action:"program.guide.exercise.update",programId:guideRow.program_id,dayIndex,locator:item.locator,name:text})}finally{setBusy("")}}} remove={async()=>{if(!confirm("¿Retirar este texto del día?"))return;setBusy(item.locator);try{await act({action:"program.guide.exercise.remove",programId:guideRow.program_id,dayIndex,locator:item.locator})}finally{setBusy("")}}}/>)}</div>
      <form className="guide-add-text" key={`add-text-${dayIndex}`} onSubmit={addText}><label>Tipo<select name="kind" defaultValue="paragraph"><option value="paragraph">Nota / indicación</option><option value="heading">Título de bloque</option></select></label><label className="guide-add-text-input">Texto nuevo<input name="text" placeholder="Ej. El mountain climber puede realizarse lentamente." required/></label><label>Ubicación<select name="position" defaultValue="end"><option value="end">Al final del día</option><option value="start">Al inicio del día</option>{textItems.map(item=>{const index=Number(item.locator.split(":")[1]);return <option key={item.locator} value={String(index+1)}>Después de: {item.text.length>40?`${item.text.slice(0,40)}…`:item.text}</option>})}</select></label><button className="primary" disabled={busy==="text-add"}>{busy==="text-add"?"Agregando…":"＋ Agregar texto"}</button></form></div>
    <form className="guide-add-exercise" onSubmit={submit}><label>Ejercicio de la biblioteca<select name="exerciseId" required defaultValue=""><option value="" disabled>Selecciona un ejercicio…</option>{exercises.map(exercise=><option value={String(exercise.id)} key={String(exercise.id)}>{String(exercise.name)}</option>)}</select></label><label>Indicación<input name="prescription" placeholder="Ej. 3 × 12 · 60 s descanso" required/></label><button className="primary" disabled={busy==="add"}>{busy==="add"?"Agregando…":"＋ Agregar al día"}</button></form>
  </section>;
}

function GuideItem({item,number,busy,save,remove}:{item:Item;number:number;busy:string;save:(name:string,prescription:string)=>Promise<void>;remove:()=>Promise<void>}){
  const [name,setName]=useState(item.name);const [prescription,setPrescription]=useState(item.prescription);
  return <article><span className="guide-edit-number">{number}</span><label>Ejercicio<input value={name} onChange={event=>setName(event.target.value)}/></label><label>Series, repeticiones o tiempo<input value={prescription} onChange={event=>setPrescription(event.target.value)} placeholder="Ej. 30 s"/></label><button className="secondary" disabled={busy===item.locator||!name.trim()} onClick={()=>save(name,prescription)}>{busy===item.locator?"Guardando…":"Guardar"}</button><button className="danger-link" disabled={busy===item.locator} onClick={remove}>Retirar</button></article>;
}

function GuideTextItem({item,busy,save,remove}:{item:TextItem;busy:string;save:(text:string)=>Promise<void>;remove:()=>Promise<void>}){
  const [text,setText]=useState(item.text);
  return <article className={`guide-text-row ${item.kind}`}><span className="guide-text-kind">{item.kind==="heading"?"TÍTULO":"NOTA"}</span><input value={text} onChange={event=>setText(event.target.value)} aria-label={item.kind==="heading"?"Texto del título":"Texto de la indicación"}/><button className="secondary" disabled={busy===item.locator||!text.trim()||text===item.text} onClick={()=>save(text)}>{busy===item.locator?"Guardando…":"Guardar"}</button><button type="button" className="danger-link" disabled={busy===item.locator} onClick={remove}>Retirar</button></article>;
}
