"use client";

import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type GuideNode = { type:string; level?:number; text?:string; name?:string; prescription?:string; headers?:string[]; rows?:Array<{cells:string[];exerciseName?:string}> };
type Guide = { programId:string; title:string; overview:GuideNode[]; days:Array<{title:string;nodes:GuideNode[]}>; reference:GuideNode[] };
type GuideTab = { key:string; label:string; title?:string; nodes:GuideNode[] };

function parseGuide(row:Row):Guide|null { try{return JSON.parse(String(row.content_json||"")) as Guide}catch{return null} }
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function dayTitle(value:string,index:number){const detail=value.includes("—")?value.split("—").slice(1).join("—").trim():value;return `DÍA ${index+1}${detail?` — ${detail}`:""}`}
function neutralSchedule(value:string){return value.replace(/lunes\s+a\s+jueves/gi,"4 días por semana").replace(/lunes\s+a\s+viernes/gi,"5 días por semana")}
function restFirst(nodes:GuideNode[]){if(!nodes.some(node=>node.type==="heading"&&/calentamiento/i.test(node.text||"")))return nodes;const arranged:GuideNode[]=[];for(let index=0;index<nodes.length;){const heading=nodes[index];if(heading.type!=="heading"){arranged.push(heading);index++;continue}let end=index+1;while(end<nodes.length&&nodes[end].type!=="heading")end++;const body=nodes.slice(index+1,end);if(/calentamiento/i.test(heading.text||""))arranged.push(heading,...body);else{const rests=body.filter(item=>item.type==="paragraph"&&/^descanso/i.test(item.text||""));arranged.push(heading,...rests,...body.filter(item=>!rests.includes(item)))}index=end}return arranged}

export function RoutineGuide({guideRow,exercises,admin=false,openExercise}:{guideRow:Row;exercises:Row[];admin?:boolean;openExercise?:(row:Row)=>void}){
  const guide=useMemo(()=>parseGuide(guideRow),[guideRow]);
  const tabs:GuideTab[]=guide?[{key:"overview",label:"Guía general",nodes:guide.overview},...guide.days.map((day,index)=>({key:`day-${index}`,label:`Día ${index+1}`,title:dayTitle(day.title,index),nodes:day.nodes})),...(guide.reference.length?[{key:"reference",label:"Progresión",title:"Progresión, intensidad y referencias",nodes:guide.reference}]:[])]:[];
  const [active,setActive]=useState(tabs.find(item=>item.key.startsWith("day-"))?.key||tabs[0]?.key||""); const tab=tabs.find(item=>item.key===active)||tabs.find(item=>item.key.startsWith("day-"))||tabs[0];
  const exerciseMap=useMemo(()=>new Map(exercises.map(item=>[normalize(String(item.name)),item])),[exercises]);
  if(!guide||!tab)return null;
  const videoAction=(name:string)=>{const exercise=exerciseMap.get(normalize(name));if(admin)return <button className="technique admin" onClick={()=>openExercise?.(exercise||{name})}>{exercise?.youtube_url?"Editar video":"＋ Agregar técnica"}</button>;return exercise?.youtube_url?<a className="technique ready" href={String(exercise.youtube_url)} target="_blank" rel="noreferrer">Ver técnica ▶</a>:<span className="technique pending">Técnica próximamente</span>};
  return <section className="routine-guide"><header className="routine-guide-head"><div><span className="eyebrow">RUTINA DEFINITIVA · PROYECTO 90</span><h1>{guide.title}</h1><p>Selecciona el día y revisa la sesión completa antes de comenzar.</p></div><div className="guide-count"><strong>{guide.days.length}</strong><span>días por semana</span></div></header><nav className="routine-day-tabs" aria-label="Días de entrenamiento">{tabs.map(item=><button key={item.key} className={item.key===tab.key?"active":""} onClick={()=>setActive(item.key)}>{item.label}</button>)}</nav><article className="routine-document"><div className="routine-document-title"><span>{tab.key==="overview"?"ANTES DE COMENZAR":tab.key==="reference"?"PARA PROGRESAR":"SESIÓN DEL DÍA"}</span><h2>{tab.title||guide.title}</h2></div><GuideNodes nodes={tab.nodes} videoAction={videoAction}/></article></section>
}

function GuideNodes({nodes,videoAction}:{nodes:GuideNode[];videoAction:(name:string)=>React.ReactNode}){
  nodes=restFirst(nodes);
  const rendered:React.ReactNode[]=[];
  for(let index=0;index<nodes.length;index++){
    const node=nodes[index];
    if(node.type==="heading"&&/calentamiento/i.test(node.text||"")){
      const warmup:GuideNode[]=[];let duration="30 s",cursor=index+1;
      while(cursor<nodes.length&&nodes[cursor].type!=="heading"){
        const item=nodes[cursor]; const seconds=(item.text||"").match(/(\d+)\s*seg/i); if(seconds)duration=`${seconds[1]} s`;
        const instruction=item.type==="paragraph"&&/(:$|cada ejercicio|cada uno|vueltas?|minutos? continuos)/i.test(item.text||"");
        if(!instruction&&(item.type==="paragraph"||item.type==="exercise"))warmup.push(item); cursor++;
      }
      rendered.push(<section className="warmup-block" key={`warmup-${index}`}><div className="warmup-block-head"><div><span className="eyebrow">BLOQUE</span><h3>Calentamiento</h3></div><small>{node.text?.replace(/calentamiento\s*[—:-]?\s*/i,"")||""}</small></div><GuideTable node={{type:"table",headers:["Ejercicio","Tiempo"],rows:warmup.map((item,position)=>{const name=(item.name||item.text||"").replace(/[.]$/,"");return {cells:[`${position+1}. ${name}`,item.prescription||duration],exerciseName:name}})}} videoAction={videoAction}/></section>);
      index=cursor-1;continue;
    }
    if(node.type==="heading"){rendered.push(node.level===1?<h2 className="guide-h1" key={index}>{node.text}</h2>:node.level===2?<h3 className="guide-h2" key={index}>{node.text}</h3>:<h4 className="guide-h3" key={index}>{node.text}</h4>);continue}
    if(node.type==="exerciseHeading"){rendered.push(<div className="guide-exercise-heading" key={index}><div><span className="exercise-dot">{index+1}</span><h3>{node.name}</h3></div>{videoAction(node.name||"")}</div>);continue}
    if(node.type==="exercise"){rendered.push(<div className="guide-exercise" key={index}><div><b>{node.name}</b><span>{node.prescription}</span></div>{videoAction(node.name||"")}</div>);continue}
    if(node.type==="table"){rendered.push(<GuideTable node={node} videoAction={videoAction} key={index}/>);continue}
    const important=/^(duración:|frecuencia:|nivel:|objetivo:|descanso:|recuperación:|metodología:|la prioridad|priorizar:|buscar:)/i.test(node.text||"");
    rendered.push(<p className={important?"guide-note":""} key={index}>{neutralSchedule(node.text||"")}</p>);
  }
  return <div className="guide-nodes">{rendered}</div>
}

function GuideTable({node,videoAction}:{node:GuideNode;videoAction:(name:string)=>React.ReactNode}){const hasExercises=node.rows?.some(row=>row.exerciseName);return <div className="guide-table-wrap"><table className="guide-table"><thead><tr>{node.headers?.map((header,index)=><th key={index}>{header}</th>)}{hasExercises&&<th>Técnica</th>}</tr></thead><tbody>{node.rows?.map((row,index)=><tr key={index}>{row.cells.map((cell,cellIndex)=><td key={cellIndex} data-label={node.headers?.[cellIndex]||""}>{cell}</td>)}{hasExercises&&<td data-label="Técnica">{row.exerciseName?videoAction(row.exerciseName):null}</td>}</tr>)}</tbody></table></div>}
