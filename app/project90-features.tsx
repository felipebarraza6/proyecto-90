"use client";

import { FormEvent, useState } from "react";

type Row = Record<string, unknown>;
type Act = (payload: Row) => Promise<unknown>;

export function settingsMap(rows: Row[] = []) {
  return Object.fromEntries(rows.map((row) => [String(row.key), String(row.value ?? "")])) as Record<string, string>;
}

export function ProgramDay({ day, graduated = false }: { day: unknown; graduated?: boolean }) {
  const current = Math.min(90, Math.max(1, Number(day || 1)));
  return <span className={`day-badge ${graduated ? "graduated" : ""}`}>{graduated ? "Graduado" : `Día ${current} de 90`}</span>;
}

export function AdminConfiguration({ settings = [], questions = [], act }: { settings?: Row[]; questions?: Row[]; act: Act }) {
  const values = settingsMap(settings);
  const [saving, setSaving] = useState(false);
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await act({ action: "settings.save", ...data }); } finally { setSaving(false); }
  }
  async function saveQuestion(event: FormEvent<HTMLFormElement>, id = "") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act({ action: "question.save", id, label: form.get("label"), fieldType: form.get("fieldType"), options: form.get("options"), position: form.get("position"), audience: form.get("audience"), required: form.get("required") === "on", active: form.get("active") === "on" });
  }
  return <>
    <div className="admin-title"><div><span className="eyebrow">CONFIGURACIÓN DEL RETO</span><h1>Herramientas y formulario inicial</h1><p>Edita enlaces y preguntas sin modificar la aplicación.</p></div></div>
    <section className="panel settings-panel"><h2>Enlaces del programa</h2><p>Estos botones aparecerán en la plataforma de todos los participantes.</p>
      <form onSubmit={saveSettings} className="settings-form">
        <label>GPT Macros<input name="gpt_macros_url" type="url" defaultValue={values.gpt_macros_url}/></label>
        <label>GPT Entrenamiento<input name="gpt_training_url" type="url" defaultValue={values.gpt_training_url}/></label>
        <label>Hábitos Firme<input name="firme_url" type="url" defaultValue={values.firme_url}/></label>
        <label>Comunidad de WhatsApp<input name="whatsapp_url" type="url" defaultValue={values.whatsapp_url}/></label>
        <label>Pago plan 30 días<input name="payment_monthly_url" type="url" defaultValue={values.payment_monthly_url} placeholder="Enlace de tu pasarela de pago"/></label>
        <label>Pago plan completo 90 días<input name="payment_full_url" type="url" defaultValue={values.payment_full_url} placeholder="Enlace de tu pasarela de pago"/></label>
        <label>Correo “Escríbele al Moya”<input name="contact_email" type="email" defaultValue={values.contact_email || "tuamiguelmoya@gmail.com"}/></label>
        <button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar enlaces"}</button>
      </form>
    </section>
    <div className="section-heading"><div><span className="eyebrow">PRIMER INGRESO</span><h2>Preguntas del formulario</h2></div></div>
    <section className="question-list">
      {questions.map((question) => <details className="panel question-editor" key={String(question.id)}>
        <summary><span>{String(question.label)}</span><small>{Number(question.active) ? "Activa" : "Oculta"} · {audienceLabel(question.audience)} · orden {String(question.position)}</small></summary>
        <form onSubmit={(event) => saveQuestion(event, String(question.id))}>
          <label>Pregunta<input name="label" defaultValue={String(question.label)}/></label>
          <div className="form-grid four"><label>Tipo<select name="fieldType" defaultValue={String(question.field_type)}><option value="text">Texto corto</option><option value="textarea">Texto largo</option><option value="number">Número</option><option value="select">Selección</option></select></label><label>Profesional<select name="audience" defaultValue={String(question.audience||"both")}><option value="both">Ambos</option><option value="nutrition">Nutricionista</option><option value="training">Preparador físico</option></select></label><label>Opciones separadas por |<input name="options" defaultValue={String(question.options || "")}/></label><label>Orden<input name="position" type="number" defaultValue={Number(question.position || 1)}/></label></div>
          <div className="check-options"><label><input name="required" type="checkbox" defaultChecked={Boolean(question.required)}/> Obligatoria</label><label><input name="active" type="checkbox" defaultChecked={Boolean(question.active)}/> Activa</label></div>
          <button className="secondary">Guardar pregunta</button>
        </form>
      </details>)}
      <details className="panel question-editor"><summary><span>＋ Agregar pregunta</span><small>Nueva pregunta editable</small></summary><form onSubmit={(event) => saveQuestion(event)}><label>Pregunta<input name="label" required/></label><div className="form-grid four"><label>Tipo<select name="fieldType"><option value="text">Texto corto</option><option value="textarea">Texto largo</option><option value="number">Número</option><option value="select">Selección</option></select></label><label>Profesional<select name="audience" defaultValue="both"><option value="both">Ambos</option><option value="nutrition">Nutricionista</option><option value="training">Preparador físico</option></select></label><label>Opciones separadas por |<input name="options"/></label><label>Orden<input name="position" type="number" defaultValue={questions.length + 1}/></label></div><div className="check-options"><label><input name="required" type="checkbox" defaultChecked/> Obligatoria</label><label><input name="active" type="checkbox" defaultChecked/> Activa</label></div><button className="primary">Agregar pregunta</button></form></details>
    </section>
  </>;
}

function audienceLabel(value: unknown) { return value === "nutrition" ? "Nutricionista" : value === "training" ? "Preparador físico" : "Ambos"; }

export function OnboardingGate({ questions = [], responses = [], act }: { questions?: Row[]; responses?: Row[]; act: Act }) {
  const [saving, setSaving] = useState(false);
  const saved = Object.fromEntries(responses.map((row) => [String(row.question_id), String(row.answer ?? "")])) as Record<string, string>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await act({ action: "onboarding.submit", ...values }); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop onboarding-backdrop"><section className="editor-modal onboarding-modal"><div className="modal-head"><div><span className="eyebrow">ANTES DE COMENZAR</span><h2>Cuéntanos sobre ti</h2><p>Estas respuestas nos permiten adaptar mejor tu experiencia durante los 90 días.</p></div></div><form onSubmit={submit}>
    {questions.map((question) => <QuestionInput key={String(question.id)} question={question} value={saved[String(question.id)]}/>) }
    <div className="health-note">Si tienes una condición de salud relevante, consulta con un profesional antes de comenzar. Proyecto 90 no reemplaza una evaluación médica o nutricional.</div>
    <button className="primary full" disabled={saving}>{saving ? "Guardando…" : "Completar y entrar a Proyecto 90"}</button>
  </form></section></div>;
}

function QuestionInput({ question, value = "" }: { question: Row; value?: string }) {
  const name = `q_${String(question.id)}`; const required = Boolean(question.required); const type = String(question.field_type);
  if (type === "textarea") return <label>{String(question.label)}<textarea name={name} defaultValue={value} required={required}/></label>;
  if (type === "select") return <label>{String(question.label)}<select name={name} defaultValue={value} required={required}><option value="">Selecciona…</option>{String(question.options || "").split("|").filter(Boolean).map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label>{String(question.label)}<input name={name} type={type === "number" ? "number" : "text"} defaultValue={value} required={required}/></label>;
}

export function ToolCards({ settings = [] }: { settings?: Row[] }) {
  const values = settingsMap(settings);
  const tools = [
    ["ai", "GPT Macros", "Registra tus comidas y recibe orientación sobre tus macros.", values.gpt_macros_url],
    ["training", "GPT Entrenamiento", "Arma y adapta entrenamientos según tu nivel e implementos.", values.gpt_training_url],
    ["firme", "Hábitos Firme", "Marca tus hábitos y construye tu adherencia diaria.", values.firme_url],
  ];
  return <><div className="section-heading"><div><span className="eyebrow">TU KIT DE APOYO</span><h2>Herramientas del reto</h2></div></div><section className="tool-grid">{tools.map(([kind,title,copy,url]) => <article className="tool-card" key={title}><ToolIcon kind={kind}/><h3>{title}</h3><p>{copy}</p>{url ? <a className="secondary" href={url} target="_blank" rel="noreferrer">Abrir herramienta ↗</a> : <span className="coming-soon">Enlace pendiente</span>}</article>)}</section><section className="community-card"><div className="community-intro"><span className="community-kicker"><i/> COMUNIDAD PROYECTO 90</span><h2>Tu proceso se hace más fuerte cuando no lo haces solo.</h2><p>Este grupo es para mantenernos en movimiento, apoyarnos y celebrar cada avance durante los 90 días.</p>{values.whatsapp_url ? <a className="primary community-cta" href={values.whatsapp_url} target="_blank" rel="noreferrer">Entrar a la comunidad <span>→</span></a> : <span className="coming-soon">Enlace de WhatsApp pendiente</span>}</div><div className="community-benefits"><h3>Úsala para avanzar</h3><div className="community-benefit-grid"><article><b>01</b><span><strong>Motivación y apoyo</strong><small>Impulsa y acompaña a otros miembros.</small></span></article><article><b>02</b><span><strong>Compartir entrenamientos</strong><small>Muestra lo que hiciste y mantén el ritmo.</small></span></article><article><b>03</b><span><strong>Avances y resultados</strong><small>Celebra cada progreso, incluso el pequeño.</small></span></article><article><b>04</b><span><strong>Dudas para las charlas</strong><small>Déjalas durante la semana previa para los profesionales.</small></span></article></div></div><div className="community-note"><b>Ten presente:</b><span>El Moya estará atento al grupo, pero no es un canal de respuesta inmediata 24/7 ni se realizan diagnósticos por chat.</span></div></section></>;
}

function ToolIcon({ kind }: { kind: string }) {
  if (kind === "firme") return <span className="tool-brand-icon firme"><img src="/logo-firme-tools.png" alt="Logo de Hábitos Firme"/></span>;
  if (kind === "training") return <span className="tool-brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 9v6M4.5 10v4M17 9v6M19.5 10v4M7 12h10M2.5 11v2M21.5 11v2"/></svg></span>;
  return <span className="tool-brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 10h6M9 14h3M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/></svg></span>;
}

export function ContactMoya({ act }: { act: Act }) {
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try { const result = await act({ action: "contact.send", ...values }) as { mailto?: string }; if (result.mailto) window.location.href = result.mailto; form.reset(); } finally { setSending(false); }
  }
  return <><div className="admin-title"><div><span className="eyebrow">CONTACTO DIRECTO</span><h1>Escríbele al Moya</h1><p>Cuéntame una duda, avance o situación general del programa.</p></div></div><section className="panel contact-panel"><form onSubmit={submit}><label>Asunto<input name="subject" required placeholder="Ej. Duda sobre mi semana de entrenamiento"/></label><label>Mensaje<textarea name="message" required placeholder="Escribe aquí tu mensaje…"/></label><div className="health-note">Este canal no reemplaza diagnóstico, consulta profesional ni atención de urgencia.</div><button className="primary" disabled={sending}>{sending ? "Preparando mensaje…" : "Enviar mensaje al Moya"}</button></form></section></>;
}

export function AdminMessages({ rows = [] }: { rows?: Row[] }) {
  return <><div className="admin-title"><div><span className="eyebrow">CONTACTO DE PARTICIPANTES</span><h1>Mensajes al Moya</h1><p>Copia de los mensajes enviados desde la plataforma.</p></div></div>{rows.length === 0 ? <article className="empty-state"><span className="icon-tile green">✉</span><h2>No hay mensajes todavía</h2><p>Los mensajes aparecerán aquí cuando un participante escriba.</p></article> : <section className="message-list">{rows.map((row) => <article className="panel message-card" key={String(row.id)}><div><span className="avatar">{String(row.first_name || row.email || "M").slice(0,1).toUpperCase()}</span><div><h3>{String(row.subject)}</h3><small>{`${row.first_name || ""} ${row.last_name || ""}`.trim() || String(row.email)} · {new Date(String(row.created_at)).toLocaleString("es-CL")}</small></div></div><p>{String(row.message)}</p><a href={`mailto:${String(row.email)}?subject=${encodeURIComponent(`Re: ${String(row.subject)}`)}`}>Responder por correo ↗</a></article>)}</section>}</>;
}
