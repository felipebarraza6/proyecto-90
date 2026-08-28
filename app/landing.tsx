import { chatGPTSignInPath } from "./chatgpt-auth";

const planItems = [
  "Ruta de entrenamiento según tu nivel",
  "Macros y guía nutricional",
  "GPT de Macros y GPT de Entrenamiento",
  "Firme durante los 90 días",
  "Videos técnicos y rutinas guiadas",
];

const supportItems = [
  "Charlas en vivo y grabaciones",
  "Grupo de WhatsApp",
  "Seguimiento humano de adherencia",
  "1 sesión individual con Moya",
  "Plataforma y biblioteca por 90 días",
];

export function Landing() {
  const signIn = chatGPTSignInPath("/");
  return <main className="p90-landing" id="inicio">
    <header className="p90-nav">
      <a className="p90-brand" href="#inicio"><img src="/proyecto90-logo.jpg" alt="Proyecto 90"/><span><b>PROYECTO 90</b><small>Tu Amigo el Moya</small></span></a>
      <nav><a href="#programa">El programa</a><a href="#incluye">Qué incluye</a><a href="#recorrido">Los 90 días</a><a href="#precios">Precios</a></nav>
      <div><a className="p90-login" href={signIn}>Ingresar a mi perfil</a><a className="p90-button" href="#matricula">Matricúlate</a></div>
    </header>

    <section className="p90-hero">
      <div className="p90-hero-copy"><span className="p90-kicker"><i/> Un programa con principio, recorrido y cierre</span><h1>Construye hábitos<br/>que puedas <em>sostener.</em></h1><p>En 90 días vas a aprender a entrenar, entender tu alimentación y crear una estructura que puedas continuar por tu cuenta.</p><div className="p90-actions"><a className="p90-button" href="#matricula">Quiero ser parte</a><a className="p90-outline" href="#incluye">Ver qué incluye</a></div><div className="p90-launch"><span><b>5 SEP 2026</b> Abren las inscripciones</span><i/><span><b>1 OCT 2026</b> Primer grupo</span></div></div>
      <div className="product-window"><header><span className="product-dots"><i/><i/><i/></span><b>Tu recorrido personal</b><small>Día 17 de 90</small></header><div className="product-greeting"><div><small>HOY, SIN COMPLICARLO</small><h2>Una acción a la vez.</h2></div><span className="mini-day"><b>17</b><small>/ 90</small></span></div><div className="product-progress"><i style={{width:"19%"}}/></div><article className="product-action"><span>01</span><div><small>ENTRENAMIENTO</small><b>Semana 3 · Día de fuerza</b><p>Ruta Gym Inicial</p></div><em>Abrir →</em></article><article className="product-action secondary-action"><span>02</span><div><small>ALIMENTACIÓN</small><b>2.150 kcal · 155 g proteína</b><p>Plan aprobado</p></div><em>Ver →</em></article><div className="product-adherence"><div><span>ADHERENCIA</span><b>81%</b></div><i><b style={{width:"81%"}}/></i><small>La meta no es hacerlo perfecto. Es aprender a volver.</small></div></div>
    </section>

    <section className="p90-manifesto"><span>No medimos solo el peso.</span><strong>Medimos tu capacidad de continuar.</strong><p>Cuando la adherencia baja, no aparece un castigo. Aparece una persona para entender qué pasó, ajustar el mínimo viable y ayudarte a retomar.</p></section>

    <section className="p90-section p90-audience" id="programa"><div className="p90-section-title"><span className="p90-kicker"><i/> Para gente real</span><h2>No necesitas más motivación.<br/><em>Necesitas una estructura.</em></h2></div><div className="audience-path"><article><b>01</b><h3>Empezar</h3><p>Quieres entrenar y no sabes cómo ordenar el primer paso.</p></article><article><b>02</b><h3>Volver</h3><p>Entrenas por períodos, pierdes constancia y vuelves a empezar.</p></article><article><b>03</b><h3>Sostener</h3><p>Tienes poco tiempo y necesitas hábitos que quepan en tu vida.</p></article><article><b>04</b><h3>Entender</h3><p>Quieres mejorar sin extremos y aprender a decidir por tu cuenta.</p></article></div><p className="p90-boundary">No busca perfección, abdominales ni una transformación extrema.</p></section>

    <section className="p90-section p90-includes" id="incluye"><div className="p90-section-title left"><span className="p90-kicker"><i/> Todo conectado</span><h2>Un plan personal.<br/><em>Acompañamiento real.</em></h2><p>Una sola ruta visible: qué hacer hoy, cómo medirlo y dónde pedir ayuda.</p></div><div className="include-layout"><article><header><span>01</span><div><small>PLAN PERSONAL</small><h3>Lo que recibes</h3></div></header><ul>{planItems.map(item=><li key={item}>{item}</li>)}</ul></article><article className="include-support"><header><span>02</span><div><small>ACOMPAÑAMIENTO</small><h3>Quién te sostiene</h3></div></header><ul>{supportItems.map(item=><li key={item}>{item}</li>)}</ul></article></div><div className="pillar-sentence"><span>Entrenamiento</span><i/> <span>Alimentación</span><i/> <span>Mentalidad + hábitos</span></div></section>

    <section className="p90-section p90-journey" id="recorrido"><div className="p90-section-title"><span className="p90-kicker"><i/> Tu recorrido</span><h2>90 días para aprender<br/><em>a continuar por tu cuenta.</em></h2></div><div className="journey-line"><article><span>01—30</span><h3>Empezar</h3><p>Onboarding, clases iniciales, plan personal y una primera acción clara.</p></article><article><span>31—60</span><h3>Consolidar</h3><p>Repetir, progresar y ajustar el proceso a tu vida real.</p></article><article><span>61—90</span><h3>Sostener</h3><p>Ganar autonomía, evaluar tu recorrido y aprender a volver.</p></article></div><div className="onboarding-note"><b>Tu Día 1 comienza con claridad.</b><span>Plan nutricional y ruta de entrenamiento dentro de 48 horas hábiles después de completar el onboarding.</span></div></section>

    <section className="p90-team"><div><span className="p90-kicker"><i/> El equipo</span><h2>Técnica, nutrición<br/>y humanidad.</h2><p>No estás comprando solo información. Estás entrando a un proceso acompañado.</p></div><div className="team-people"><article><span>F</span><div><small>ENTRENAMIENTO</small><h3>Felipe</h3><p>Seguridad, técnica y progresión.</p></div></article><article><span>J</span><div><small>NUTRICIÓN</small><h3>Javi</h3><p>Macros convertidos en decisiones comprensibles.</p></div></article><article><span>M</span><div><small>ADHERENCIA</small><h3>Moya</h3><p>Seguimiento humano para ayudarte a volver.</p></div></article></div></section>

    <section className="p90-section p90-pricing" id="precios"><div className="p90-section-title"><span className="p90-kicker"><i/> Inversión</span><h2>El mismo programa.<br/><em>Dos formas de pagar.</em></h2><p>Proyecto 90 está diseñado para terminar. No es una membresía eterna.</p></div><div className="price-layout"><article><span>FACILIDAD DE PAGO</span><div><small>$</small><strong>29.990</strong></div><b>Mensual · hasta 3 pagos</b><p>Mantienes acceso durante el período pagado. Puedes detener los próximos cobros.</p><a className="p90-outline" href="#matricula">Elegir pago mensual</a></article><article className="price-featured"><span>PAGO ÚNICO · 90 DÍAS</span><div><small>$</small><strong>69.990</strong></div><b>Ahorras $19.980</b><p>Acceso completo al recorrido desde el inicio y sin renovaciones mensuales.</p><a className="p90-button" href="#matricula">Elegir pago único</a></article></div><div className="price-clarity"><span>✓ Acceso durante los 90 días</span><span>✓ Plan personal y acompañamiento</span><span>✓ Condiciones de cobro visibles</span></div></section>

    <section className="p90-final" id="matricula"><img src="/proyecto90-logo.jpg" alt="Proyecto 90"/><span className="p90-kicker"><i/> Generación 01</span><h2>El programa termina.<br/><em>Los hábitos continúan.</em></h2><p>Inscripciones desde el 5 de septiembre de 2026. Primer grupo desde el 1 de octubre.</p><div className="p90-final-price"><span>Desde</span><b>$29.990</b><small>mensuales, hasta 3 pagos</small></div><div className="p90-actions centered"><a className="p90-button" href={signIn}>Matricúlate en Proyecto 90</a><a className="p90-outline" href={signIn}>Ingresar a mi perfil</a></div></section>

    <footer className="p90-footer"><span>PROYECTO 90 · TU AMIGO EL MOYA × FIRME</span><p>WhatsApp acompaña, pero no reemplaza diagnósticos ni consultas profesionales.</p></footer>
  </main>;
}
