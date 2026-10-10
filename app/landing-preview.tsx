"use client";

import { useEffect, useState } from "react";

const previewViews = ["adherencia", "semana", "progreso"] as const;
type PreviewView = (typeof previewViews)[number];

const labels: Record<PreviewView, string> = {
  adherencia: "Adherencia",
  semana: "Mi semana",
  progreso: "Progreso",
};

export function LandingPreview() {
  const [active, setActive] = useState<PreviewView>("adherencia");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => previewViews[(previewViews.indexOf(current) + 1) % previewViews.length]);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [paused]);

  return <div className="product-window product-demo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
    <header><span className="product-dots" aria-hidden="true"><i/><i/><i/></span><b>Así se ve tu proceso</b><small>Demo interactiva</small></header>
    <div className="product-tabs" role="tablist" aria-label="Vistas de la plataforma">
      {previewViews.map((view) => <button key={view} type="button" role="tab" aria-selected={active === view} onClick={() => setActive(view)}>{labels[view]}</button>)}
    </div>
    <div className="product-scene" key={active}>
      {active === "adherencia" && <AdherenceView />}
      {active === "semana" && <WeekView />}
      {active === "progreso" && <ProgressView />}
    </div>
  </div>;
}

function AdherenceView() {
  return <>
    <div className="preview-lead"><div><small>TU INDICADOR PRINCIPAL</small><h2>81% de adherencia</h2><p>El indicador que realmente mueve tus resultados.</p></div><span className="adherence-ring"><b>81%</b><small>esta semana</small></span></div>
    <div className="product-adherence featured-adherence"><div><span>ACCIONES ACORDADAS</span><b>13 de 16</b></div><i><b style={{width:"81%"}}/></i><small>Cuando sostienes las acciones acordadas, avanzar hacia tus objetivos se convierte en una consecuencia.</small></div>
    <div className="preview-signals"><span><i className="done">✓</i><b>3/3</b><small>entrenamientos</small></span><span><i className="done">✓</i><b>Activo</b><small>plan alimentario</small></span><span><i>↗</i><b>En curso</b><small>seguimiento</small></span></div>
  </>;
}

function WeekView() {
  return <>
    <div className="product-greeting"><div><small>ESTA SEMANA, SIN COMPLICARLO</small><h2>Cumplir lo acordado.</h2><p>Cada acción completada alimenta tu adherencia.</p></div><span className="week-score"><b>3</b><small>acciones clave</small></span></div>
    <article className="product-action completed"><span>01</span><div><small>ENTRENAMIENTO</small><b>Día de fuerza</b><p>Completado · Ruta Gym Inicial</p></div><em>✓</em></article>
    <article className="product-action"><span>02</span><div><small>ALIMENTACIÓN</small><b>Seguir mi plan personal</b><p>Objetivos diarios disponibles</p></div><em>Abrir →</em></article>
    <article className="product-action secondary-action"><span>03</span><div><small>SEGUIMIENTO</small><b>Registrar cómo voy</b><p>Una revisión breve y honesta</p></div><em>Ver →</em></article>
  </>;
}

function ProgressView() {
  return <>
    <div className="product-greeting"><div><small>TU PROGRESO</small><h2>La constancia se acumula.</h2><p>No se trata de una semana perfecta, sino de seguir volviendo.</p></div><span className="trend-badge"><b>↗ 8%</b><small>tendencia</small></span></div>
    <div className="checkpoint-track" aria-label="Hitos del programa"><i/><span className="passed"><b>Inicio</b><small>✓</small></span><span className="passed"><b>Día 30</b><small>✓</small></span><span className="current"><b>Día 60</b><small>●</small></span><span><b>Día 90</b><small>○</small></span></div>
    <div className="progress-weeks"><span><small>SEM 1</small><i><b style={{height:"58%"}}/></i></span><span><small>SEM 2</small><i><b style={{height:"66%"}}/></i></span><span><small>SEM 3</small><i><b style={{height:"74%"}}/></i></span><span className="active"><small>SEM 4</small><i><b style={{height:"81%"}}/></i></span></div>
    <div className="progress-message"><i>✓</i><span><b>La adherencia marca el camino</b><small>Más constancia significa más oportunidades de acercarte a tu objetivo.</small></span></div>
  </>;
}
