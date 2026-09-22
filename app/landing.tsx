import { LandingPreview } from "./landing-preview";
import { Enroll } from "./enroll";

const planItems = [
  "Rutina de entrenamiento según tu nivel, para hacer en casa o en gimnasio",
  "Cálculo profesional de macros y pauta nutricional educativa",
  "Acceso y capacitación para usar GPT Macros y GPT Entrenamiento",
  "Acceso a la plataforma de gestión de hábitos durante 90 días",
  "Videos explicativos de tus ejercicios y rutinas guiadas",
];

const supportItems = [
  "Sesiones en vivo y acceso a sus grabaciones",
  "Comunidad de WhatsApp",
  "Seguimiento de tu adherencia por Tu Amigo el Moya",
  "Una sesión individual con Moya durante el proceso",
  "Biblioteca de contenidos disponible durante 90 días",
];

const teamMembers = [
  {type:"training",role:"ENTRENAMIENTO",name:"Coach Felipe",title:"Kinesiólogo y entrenador",description:"Seguridad, técnica y progresión para entrenar mejor.",icon:"↔",handle:"@felipe.andres_ng",url:"https://www.instagram.com/felipe.andres_ng/"},
  {type:"nutrition",role:"NUTRICIÓN",name:"Javi",title:"Nutricionista deportiva",description:"Calcula tus macros y los transforma en una pauta nutricional educativa.",icon:"◒",handle:"@javinutri_fit",url:"https://www.instagram.com/javinutri_fit/"},
  {type:"habits",role:"ADHERENCIA · CONTACTO · HÁBITOS",name:"Tu Amigo el Moya",title:"Seguimiento humano",description:"Acompañamiento cercano para ayudarte a sostener este proceso.",icon:"◎",handle:"@tuamigoelmoya",url:"https://www.instagram.com/tuamigoelmoya/"},
];

export function Landing({ onLogin }: { onLogin: () => void }) {
  return <main className="p90-landing" id="inicio">
    <header className="p90-nav">
      <a className="p90-brand" href="#inicio"><img src="/proyecto90-logo.jpg" alt="Proyecto 90"/><span><b>PROYECTO 90</b><small>Tu Amigo el Moya</small></span></a>
      <nav><a href="#programa">El programa</a><a href="#incluye">Qué incluye</a><a href="#recorrido">Los 90 días</a><a href="#precios">Precios</a></nav>
      <div><a className="p90-login" onClick={(e) => { e.preventDefault(); onLogin(); }} href="#login">Ingresar a mi perfil</a><a className="p90-button" href="#matricula">Matricúlate</a></div>
    </header>

    <section className="p90-hero">
      <div className="p90-hero-copy"><span className="p90-kicker"><i/> Un programa con principio, recorrido y cierre</span><h1>Construye hábitos<br/>que puedas <em>sostener.</em></h1><p>Durante 90 días aprenderás a entrenar, alimentarte y construir la adherencia necesaria para sostener tus resultados.</p><div className="p90-actions"><a className="p90-button" href="#matricula">Quiero ser parte</a><a className="p90-outline" href="#incluye">Ver qué incluye</a></div><div className="p90-evergreen"><i/>Entrenamiento, alimentación y seguimiento en un solo proceso.</div></div>
      <LandingPreview />
    </section>

    <section className="p90-manifesto"><span>No medimos solo el peso.</span><strong>Medimos tu capacidad de continuar.</strong><p>Cuando la adherencia baja, no aparece un castigo. Aparece una persona para entender qué pasó, ajustar el mínimo viable y ayudarte a retomar.</p></section>

    <section className="p90-section p90-audience" id="programa"><div className="p90-section-title"><span className="p90-kicker"><i/> A quién está dirigido</span><h2>No necesitas más motivación.<br/><em>Necesitas una estructura de hábitos y seguimiento.</em></h2></div><div className="audience-path dynamic-audience"><article><div className="audience-card-top"><b>01</b><span>CLARIDAD</span></div><i aria-hidden="true">→</i><h3>Empezar</h3><p>Quieres entrenar y no sabes cómo ordenar el primer paso.</p><small>Encontrar una primera acción clara</small></article><article><div className="audience-card-top"><b>02</b><span>RETOMAR</span></div><i aria-hidden="true">↻</i><h3>Volver</h3><p>Entrenas por períodos, pierdes constancia y vuelves a empezar.</p><small>Volver sin sentir que perdiste todo</small></article><article><div className="audience-card-top"><b>03</b><span>CONSTANCIA</span></div><i aria-hidden="true">✓</i><h3>Sostener</h3><p>Tienes poco tiempo y necesitas hábitos que quepan en tu vida.</p><small>Repetir lo importante en tu vida real</small></article><article><div className="audience-card-top"><b>04</b><span>AUTONOMÍA</span></div><i aria-hidden="true">↗</i><h3>Entender</h3><p>Quieres mejorar sin extremos y aprender a decidir por tu cuenta.</p><small>Continuar con tus propias herramientas</small></article></div><div className="p90-boundary adherence-boundary"><span>NUESTRO OBJETIVO</span><strong>Construir adherencia y hábitos que puedas sostener durante el programa y continuar por tu cuenta cuando termine.</strong></div></section>

    <section className="p90-section p90-includes" id="incluye"><div className="p90-section-title left"><span className="p90-kicker"><i/> Qué incluye</span><h2>Un plan personal.<br/><em>Seguimiento para sostenerlo.</em></h2><p>Tu plan define qué hacer. El seguimiento muestra cómo vas y cuándo necesitas apoyo.</p></div><div className="include-layout dynamic-includes"><article><header><span>01</span><div><small>PLAN PERSONAL</small><h3>Tu ruta durante 90 días</h3></div></header><ul>{planItems.map((item,index)=><li key={item}><span>{String(index+1).padStart(2,"0")}</span><p>{item}</p></li>)}</ul><aside className="nutrition-scope"><b>ALCANCE DEL APOYO NUTRICIONAL</b><p>Incluye el cálculo de tus macros y una pauta educativa. No contempla consultas individuales permanentes con la nutricionista.</p></aside></article><article className="include-support"><header><span>02</span><div><small>SEGUIMIENTO</small><h3>Cómo te acompañamos</h3></div></header><ul>{supportItems.map((item,index)=><li key={item}><span>{String(index+1).padStart(2,"0")}</span><p>{item}</p></li>)}</ul><div className="adherence-focus"><span>INDICADOR PRINCIPAL</span><strong>Tu adherencia</strong><small>Medimos para ajustar, ayudarte a volver y sostener el proceso.</small></div></article></div><div className="pillar-sentence"><span>Entrenamiento</span><i/> <span>Alimentación</span><i/> <span>Gestión de hábitos</span></div></section>

    <section className="p90-section p90-journey" id="recorrido"><div className="p90-section-title"><span className="p90-kicker"><i/> Tu recorrido</span><h2>90 días para aprender<br/><em>a sostener tus hábitos y continuar por tu cuenta.</em></h2></div><div className="journey-line dynamic-journey"><article><header><span>ETAPA 01</span><b>DÍAS 01—30</b></header><i aria-hidden="true">→</i><h3>Empezar</h3><p>Onboarding, clases iniciales, plan personal y una primera acción clara.</p><footer>ORDENAR EL PRIMER PASO</footer></article><article><header><span>ETAPA 02</span><b>DÍAS 31—60</b></header><i aria-hidden="true">↗</i><h3>Consolidar</h3><p>Repetir, progresar y ajustar el proceso a tu vida real.</p><footer>CONVERTIR ACCIONES EN HÁBITOS</footer></article><article><header><span>ETAPA 03</span><b>DÍAS 61—90</b></header><i aria-hidden="true">✓</i><h3>Sostener</h3><p>Ganar autonomía, evaluar tu recorrido y aprender a volver.</p><footer>CONTINUAR CON AUTONOMÍA</footer></article></div><div className="onboarding-note professional-review-note"><b>Tu Día 1 comienza con claridad.</b><span>Recibirás tu plan nutricional y tu ruta de entrenamiento dentro de 72 horas hábiles después de completar el onboarding, porque ambos serán revisados por nuestros profesionales.</span></div></section>

    <section className="p90-team dynamic-team"><div className="team-intro"><span className="p90-kicker"><i/> El equipo profesional</span><h2>Técnica, nutrición<br/>y comunidad.</h2><p>No estás comprando solo información. Estás entrando al entorno adecuado.</p><div className="team-proof"><span>3 miradas profesionales</span><i/><span>1 proceso conectado</span></div></div><div className="team-people">{teamMembers.map((member,index)=><article className={`team-card ${member.type}`} key={member.handle}><span className="team-icon" aria-hidden="true">{member.icon}</span><div><header><small>{member.role}</small><b>0{index+1}</b></header><h3>{member.name}</h3><strong>{member.title}</strong><p>{member.description}</p><a href={member.url} target="_blank" rel="noreferrer" aria-label={`Instagram de ${member.name}`}><span>@</span>{member.handle.slice(1)} ↗</a></div></article>)}</div></section>

    <Enroll onLogin={onLogin} />

    <section className="p90-final" id="cierre"><img src="/proyecto90-logo.jpg" alt="Proyecto 90"/><span className="p90-kicker"><i/> Proyecto 90</span><h2>El programa termina.<br/><em>Los hábitos continúan.</em></h2><p>Entrenamiento, alimentación y seguimiento conectados para ayudarte a sostener el proceso.</p><div className="p90-actions centered"><a className="p90-button" href="#matricula">Matricúlate en Proyecto 90</a><a className="p90-outline" onClick={(e) => { e.preventDefault(); onLogin(); }} href="#login">Ingresar a mi perfil</a></div></section>

    <footer className="p90-footer"><span>PROYECTO 90 · TU AMIGO EL MOYA</span><p>WhatsApp acompaña, pero no reemplaza diagnósticos ni consultas profesionales.</p></footer>
  </main>;
}
