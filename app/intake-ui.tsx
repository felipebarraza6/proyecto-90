"use client";

import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Action = (payload: Row) => Promise<unknown>;

const audienceLabel: Record<string,string> = { both:"Coach + Nutricionista", coach:"Personal trainer", nutrition:"Nutricionista" };
const typeLabel: Record<string,string> = { text:"Respuesta corta",textarea:"Respuesta larga",number:"Número",date:"Fecha",single:"Selección única",multi:"Selección múltiple",yesno:"Sí / No",scale:"Escala 0 a 10",consent:"Consentimiento" };

function optionsOf(question: Row) {
  try { return question.options_json ? JSON.parse(String(question.options_json)) as string[] : []; } catch { return []; }
}
function answerOf(response: Row | undefined) {
  try { return response?.answer_json ? JSON.parse(String(response.answer_json)) : ""; } catch { return ""; }
}
function hasValue(value: unknown) { return !(value == null || value === "" || (Array.isArray(value) && value.length === 0)); }

export function IntakeForm({questions,responses,act}:{questions:Row[];responses:Row[];act:Action}) {
  const sections = useMemo(()=>Array.from(new Set(questions.map(q=>String(q.section)))),[questions]);
  const initial = useMemo(()=>Object.fromEntries(questions.map(q=>[String(q.id),answerOf(responses.find(r=>String(r.question_id)===String(q.id)))])),[questions,responses]);
  const [answers,setAnswers] = useState<Record<string,unknown>>(initial);
  const [step,setStep] = useState(0); const [saving,setSaving] = useState(false); const [warning,setWarning] = useState("");
  const byKey = Object.fromEntries(questions.map(q=>[String(q.key),answers[String(q.id)]]));
  const visible = questions.filter(q=>String(q.section)===sections[step] && (!q.condition_key || byKey[String(q.condition_key)]===q.condition_value));
  function set(id:string,value:unknown){setAnswers(current=>({...current,[id]:value}));setWarning("")}
  function validate(){const missing=visible.filter(q=>Boolean(q.required)&&!hasValue(answers[String(q.id)]));if(missing.length){setWarning(`Completa ${missing.length===1?"la pregunta obligatoria":"las preguntas obligatorias"} antes de continuar.`);return false}return true}
  async function next(){if(!validate())return;if(step<sections.length-1){setStep(step+1);window.scrollTo({top:0,behavior:"smooth"});return}setSaving(true);try{await act({action:"intake.submit",responses:answers})}finally{setSaving(false)}}
  return <div className="intake-first-login">
    <header className="intake-welcome"><img className="brand-wordmark intake-logo" src="/proyecto90-logo.jpg" alt="Proyecto 90" width="384" height="384"/><div><span className="eyebrow">PRIMER INGRESO</span><h1>Conozcámonos antes de comenzar</h1><p>Tus respuestas permiten que el coach y la nutricionista preparen un plan seguro y realmente personal.</p></div></header>
    <div className="intake-progress"><div><span style={{width:`${((step+1)/sections.length)*100}%`}}/></div><p>Paso {step+1} de {sections.length} · {sections[step]}</p></div>
    <section className="intake-form-card"><div className="intake-section-head"><span className="eyebrow">{String(step+1).padStart(2,"0")}</span><h2>{sections[step]}</h2><p>Los campos marcados con * son obligatorios.</p></div>
      <div className="intake-fields">{visible.map(q=><QuestionField key={String(q.id)} question={q} value={answers[String(q.id)]} setValue={v=>set(String(q.id),v)}/>)}</div>
      {warning&&<p className="intake-warning">{warning}</p>}
      <footer className="intake-actions">{step>0&&<button className="secondary" onClick={()=>setStep(step-1)}>← Volver</button>}<span/><button className="primary" disabled={saving} onClick={next}>{saving?"Enviando…":step===sections.length-1?"Enviar a mi equipo ✓":"Continuar →"}</button></footer>
    </section><p className="intake-privacy">Información privada. Cada profesional verá únicamente las respuestas necesarias para su trabajo.</p>
  </div>
}

function QuestionField({question,value,setValue}:{question:Row;value:unknown;setValue:(value:unknown)=>void}) {
  const id=String(question.id), type=String(question.type), opts=optionsOf(question), selected=Array.isArray(value)?value.map(String):[];
  return <fieldset className="intake-question"><legend>{String(question.prompt)}{Boolean(question.required)&&<sup>*</sup>}</legend>{question.help_text&&<p>{String(question.help_text)}</p>}
    {(type==="text"||type==="number"||type==="date")&&<input id={id} type={type} value={String(value??"")} min={type==="number"?0:undefined} onChange={e=>setValue(e.target.value)}/>} 
    {type==="textarea"&&<textarea value={String(value??"")} rows={4} onChange={e=>setValue(e.target.value)}/>} 
    {(type==="single"||type==="yesno")&&<div className="choice-grid">{(type==="yesno"?["Sí","No"]:opts).map(option=><label key={option} className={value===option?"selected":""}><input type="radio" name={id} checked={value===option} onChange={()=>setValue(option)}/><span>{option}</span></label>)}</div>}
    {type==="multi"&&<div className="choice-grid multi">{opts.map(option=><label key={option} className={selected.includes(option)?"selected":""}><input type="checkbox" checked={selected.includes(option)} onChange={e=>setValue(e.target.checked?[...selected,option]:selected.filter(x=>x!==option))}/><span>{option}</span></label>)}</div>}
    {type==="scale"&&<div className="scale-grid">{Array.from({length:11},(_,n)=>n).map(n=><button type="button" className={Number(value)===n?"selected":""} key={n} onClick={()=>setValue(n)}>{n}</button>)}</div>}
    {type==="consent"&&<label className={`consent-box ${value===true?"selected":""}`}><input type="checkbox" checked={value===true} onChange={e=>setValue(e.target.checked)}/><span>Acepto y confirmo que la información entregada es correcta.</span></label>}
  </fieldset>
}

export function IntakeConfig({questions,act}:{questions:Row[];act:Action}) {
  const [editing,setEditing]=useState<Row|null>(null); const [saving,setSaving]=useState(false);
  const sections=Array.from(new Set(questions.map(q=>String(q.section))));
  async function save(form:HTMLFormElement){const values=Object.fromEntries(new FormData(form).entries());setSaving(true);try{await act({action:"intake.question.update",id:editing?.id,...values,required:values.required==="on",active:values.active==="on"});setEditing(null)}finally{setSaving(false)}}
  return <><div className="admin-title"><div><span className="eyebrow">CONFIGURACIÓN · PRIMER INGRESO</span><h1>Preguntas del formulario</h1><p>{questions.length} preguntas organizadas por especialidad. Las compartidas se preguntan una sola vez.</p></div></div>
    <div className="intake-legend"><span className="audience both">● Ambos</span><span className="audience coach">● Personal trainer</span><span className="audience nutrition">● Nutricionista</span></div>
    {sections.map(section=><section className="question-admin-section" key={section}><div className="section-heading"><div><span className="eyebrow">SECCIÓN</span><h2>{section}</h2></div><small>{questions.filter(q=>q.section===section).length} preguntas</small></div>{questions.filter(q=>q.section===section).map(q=><article className={`question-admin-row ${q.active?"":"inactive"}`} key={String(q.id)}><div><h3>{String(q.prompt)}</h3><p>{typeLabel[String(q.type)]} · Orden {String(q.position)} {q.required?"· Obligatoria":"· Opcional"}</p></div><span className={`audience ${String(q.audience)}`}>{audienceLabel[String(q.audience)]}</span><div className="question-actions"><button className="secondary" onClick={()=>setEditing(q)}>Editar</button><button className="danger-link" onClick={()=>confirm(`¿Eliminar esta pregunta? También se eliminarán las respuestas históricas asociadas.\n\n${String(q.prompt)}`)&&act({action:"intake.question.delete",id:q.id})}>Eliminar</button></div></article>)}</section>)}
    {editing&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}><section className="editor-modal"><div className="modal-head"><div><span className="eyebrow">EDITAR PREGUNTA</span><h2>Formulario de primer ingreso</h2></div><button onClick={()=>setEditing(null)}>×</button></div><form onSubmit={e=>{e.preventDefault();save(e.currentTarget)}}><label>Pregunta<textarea name="prompt" defaultValue={String(editing.prompt)} required/></label><div className="form-grid two"><label>Sección<input name="section" defaultValue={String(editing.section)}/></label><label>Visible para<select name="audience" defaultValue={String(editing.audience)}><option value="both">Ambos profesionales</option><option value="coach">Personal trainer</option><option value="nutrition">Nutricionista</option></select></label><label>Tipo<select name="type" defaultValue={String(editing.type)}>{Object.entries(typeLabel).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>Orden<input name="position" type="number" defaultValue={String(editing.position)}/></label></div><label>Ayuda para el participante<input name="helpText" defaultValue={String(editing.help_text||"")}/></label><label>Alternativas (una por línea)<textarea name="options" defaultValue={optionsOf(editing).join("\n")}/></label><div className="admin-checks"><label><input name="required" type="checkbox" defaultChecked={Boolean(editing.required)}/> Obligatoria</label><label><input name="active" type="checkbox" defaultChecked={Boolean(editing.active)}/> Activa</label></div><div className="editor-actions"><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button></div></form></section></div>}
  </>
}

export function IntakeResponses({participant,questions,responses}:{participant:Row;questions:Row[];responses:Row[]}) {
  const own=responses.filter(r=>String(r.user_id)===String(participant.id)); const answerMap=Object.fromEntries(own.map(r=>[String(r.question_id),answerOf(r)]));
  const sections=Array.from(new Set(questions.map(q=>String(q.section))));
  return <div className="intake-response-view"><div className="response-profile"><span className="avatar large">{initials(`${participant.first_name||""} ${participant.last_name||""}`)}</span><div><span className="eyebrow">FICHA DE PRIMER INGRESO</span><h2>{`${participant.first_name||""} ${participant.last_name||""}`.trim()||String(participant.email)}</h2><p>{participant.intake_completed_at?`Respondido el ${new Date(String(participant.intake_completed_at)).toLocaleDateString("es-CL")}`:"Formulario aún pendiente"}</p></div></div>{!participant.intake_completed_at?<div className="empty-state compact"><h3>El participante aún no responde</h3><p>La ficha aparecerá aquí cuando complete su primer ingreso.</p></div>:sections.map(section=><section className="response-section" key={section}><h3>{section}</h3>{questions.filter(q=>q.section===section).map(q=><div className="response-row" key={String(q.id)}><p>{String(q.prompt)}</p><strong>{formatAnswer(answerMap[String(q.id)])}</strong><span className={`audience ${String(q.audience)}`}>{audienceLabel[String(q.audience)]}</span></div>)}</section>)}</div>
}

function formatAnswer(value:unknown){if(Array.isArray(value))return value.join(", ")||"Sin respuesta";if(value===true)return "Sí, aceptado";if(value===false)return "No";return hasValue(value)?String(value):"Sin respuesta"}
function initials(name:string){return name.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"90"}
