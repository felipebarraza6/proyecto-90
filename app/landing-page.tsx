export function LandingPage({monthlyPaymentUrl="",fullPaymentUrl=""}:{monthlyPaymentUrl?:string;fullPaymentUrl?:string}) {
  return <main className="landing-main">
    <header className="landing-header">
      <a className="landing-brand" href="#inicio" aria-label="Proyecto 90, inicio">
        <img src="/proyecto-90-logo-transparente.png" alt="Proyecto 90" />
      </a>
      <nav aria-label="Navegación principal">
        <a href="#programa">El programa</a>
        <a href="#incluye">Qué incluye</a>
        <a href="#recorrido">Los 90 días</a>
        <a href="#ingresar">Ya soy alumno</a>
        <a className="landing-login-link" href="#valores">Matricúlate</a>
      </nav>
    </header>

    <section className="landing-hero" id="inicio">
      <div className="landing-hero-copy">
        <span className="landing-kicker"><i /> UN PROGRAMA CON PRINCIPIO, RECORRIDO Y CIERRE</span>
        <h1>Construye hábitos que puedas <em>sostener.</em></h1>
        <p>Durante 90 días vas a aprender a entrenar, entender tu alimentación y crear una estructura realista para continuar por tu cuenta.</p>
        <div className="landing-hero-actions">
          <a className="landing-primary" href="#valores">Matricúlate en Proyecto 90</a>
          <a className="landing-secondary" href="#programa">Conocer el programa</a>
        </div>
        <p className="landing-launch"><b>Inscripciones desde el 1 de septiembre de 2026</b><span>Primer grupo · 1 de octubre de 2026</span></p>
        <div className="landing-proof">
          <div><strong>90</strong><span>días con una ruta clara</span></div>
          <div><strong>3</strong><span>pilares conectados</span></div>
          <div><strong>4</strong><span>rutas de entrenamiento</span></div>
        </div>
      </div>
      <div className="landing-hero-visual">
        <div className="hero-glow" />
        <img src="/proyecto-90-logo-transparente.png" alt="Logo oficial Proyecto 90" />
        <div className="hero-status"><span>●</span><b>Tu recorrido personal</b><small>Día 1 — Día 90</small></div>
      </div>
    </section>

    <section className="landing-strip" aria-label="Características principales">
      <span>INGRESO CONTINUO</span><i />
      <span>ACOMPAÑAMIENTO HUMANO</span><i />
      <span>ENTRENAMIENTO + ALIMENTACIÓN + HÁBITOS</span><i />
      <span>UNA META CONCRETA: ADHERENCIA</span>
    </section>

    <section className="landing-section audience-section" id="programa">
      <div className="landing-section-head">
        <span className="landing-kicker">PARA GENTE REAL</span>
        <h2>Una estructura para dejar de empezar de cero.</h2>
        <p>Proyecto 90 no busca perfección ni una transformación extrema. Está pensado para personas que quieren cambiar, pero necesitan una ruta que quepa en su vida.</p>
      </div>
      <div className="audience-grid">
        <article><span>01</span><h3>Empezar</h3><p>Ordena el primer paso y comienza con una acción clara.</p></article>
        <article><span>02</span><h3>Volver</h3><p>Retoma el proceso sin sentir que perdiste todo el avance.</p></article>
        <article><span>03</span><h3>Sostener</h3><p>Construye hábitos que funcionen incluso con poco tiempo.</p></article>
        <article><span>04</span><h3>Entender</h3><p>Aprende a tomar mejores decisiones sin extremos.</p></article>
      </div>
    </section>

    <section className="landing-section promise-section">
      <div className="promise-copy">
        <span className="landing-kicker">LA PROMESA</span>
        <h2>Aprender a continuar por tu cuenta.</h2>
        <p>Los cambios físicos pueden ser una consecuencia del proceso. Lo que trabajamos de forma directa es tu capacidad de cumplir, medir, ajustar y volver.</p>
        <div className="promise-contrast"><span>NO MEDIMOS SOLO <b>EL PESO</b></span><span>MEDIMOS <b>ADHERENCIA</b></span></div>
      </div>
      <div className="adherence-card">
        <span>SEMANA DE EJEMPLO</span>
        <strong>81<small>%</small></strong>
        <h3>Adherencia total</h3>
        <div><i style={{width:"82%"}} /><b>Entrenamiento · 82%</b></div>
        <div><i style={{width:"74%"}} /><b>Nutrición · 74%</b></div>
        <div><i style={{width:"88%"}} /><b>Hábitos · 88%</b></div>
        <p>El número no castiga. Nos muestra dónde ajustar antes de abandonar.</p>
      </div>
    </section>

    <section className="landing-section" id="incluye">
      <div className="landing-section-head compact">
        <span className="landing-kicker">UN SISTEMA COMPLETO</span>
        <h2>Tres pilares. Un mismo objetivo.</h2>
      </div>
      <div className="pillar-grid">
        <article><span>01</span><PillarIcon type="training"/><h3>Entrenamiento</h3><p>Una ruta asignada según tu nivel, técnica guiada, progresiones y sesiones que puedes seguir con claridad.</p></article>
        <article><span>02</span><PillarIcon type="nutrition"/><h3>Alimentación</h3><p>Macros, guía nutricional y herramientas para entender las decisiones cotidianas sin complicarte.</p></article>
        <article className="featured"><span>03</span><PillarIcon type="habits"/><h3>Mentalidad + hábitos</h3><p>Seguimiento con Firme y acompañamiento para aprender a volver incluso después de una mala semana.</p></article>
      </div>
      <div className="included-grid">
        <div><span className="landing-kicker">TU PLAN PERSONAL</span><ul><li>Ruta de entrenamiento asignada</li><li>Macros + guía nutricional</li><li>GPT de Macros y GPT de Entrenamiento</li><li>Firme durante los 90 días</li><li>Videos técnicos y rutinas guiadas</li></ul></div>
        <div><span className="landing-kicker">ACOMPAÑAMIENTO</span><ul><li>Charlas en vivo y grabaciones</li><li>Comunidad de WhatsApp</li><li>Seguimiento de adherencia</li><li>1 sesión personal con Moya</li><li>Biblioteca que crece con el tiempo</li></ul></div>
      </div>
    </section>

    <section className="landing-section journey-section" id="recorrido">
      <div className="landing-section-head compact">
        <span className="landing-kicker">TU PROPIO RELOJ</span>
        <h2>Cada persona vive sus propios 90 días.</h2>
        <p>Puedes ingresar en cualquier momento. Tu recorrido comienza en el Día 1 y termina cuando completas el Día 90.</p>
      </div>
      <div className="journey-line">
        <div><b>1</b><span>Onboarding</span><small>Objetivos, salud y nivel</small></div>
        <i /><div><b>30</b><span>Primer ajuste</span><small>Medir y volver</small></div>
        <i /><div><b>60</b><span>Consolidación</span><small>Más autonomía</small></div>
        <i /><div className="active"><b>90</b><span>Cierre personal</span><small>Continuar por tu cuenta</small></div>
      </div>
      <div className="route-grid">
        <article><small>CASA</small><h3>Básico</h3><p>Hasta 40 minutos y pocos implementos.</p></article>
        <article><small>CASA</small><h3>Intermedio</h3><p>Progresiones y mayor volumen.</p></article>
        <article><small>GYM</small><h3>Básico</h3><p>Técnica, máquinas y progresión simple.</p></article>
        <article><small>GYM</small><h3>Intermedio</h3><p>Más volumen, intensidad y autonomía.</p></article>
      </div>
    </section>

    <section className="landing-section pricing-section" id="valores">
      <div className="landing-section-head compact">
        <span className="landing-kicker">UN PROGRAMA DE 90 DÍAS, NO UNA MEMBRESÍA ETERNA</span>
        <h2>Elige cómo quieres pagarlo.</h2>
        <p>Las dos alternativas dan acceso al mismo recorrido completo, a tu plataforma y al acompañamiento del programa.</p>
      </div>
      <div className="pricing-grid">
        <article><span>PLAN 30 DÍAS</span><strong>$29.990</strong><b>1 cuota · acceso por 30 días</b><p>Comienzas con el primer mes. Antes de que termine tu acceso recibirás el aviso para pagar la siguiente cuota y continuar el recorrido.</p>{monthlyPaymentUrl?<a className="landing-primary pricing-action" href={monthlyPaymentUrl}>Pagar 30 días <span>→</span></a>:<button className="pricing-action pending" disabled>Pago disponible próximamente</button>}</article>
        <article className="featured"><span>PLAN COMPLETO · 90 DÍAS</span><strong>$69.990</strong><b>pago único · ahorras $19.980</b><p>Acceso completo durante los 90 días desde el inicio, sin renovaciones ni cuotas pendientes.</p>{fullPaymentUrl?<a className="landing-primary pricing-action" href={fullPaymentUrl}>Pagar programa completo <span>→</span></a>:<button className="pricing-action pending" disabled>Pago disponible próximamente</button>}<em>OPCIÓN RECOMENDADA</em></article>
      </div>
      <div className="enrollment-flow"><div className="enrollment-flow-head"><span className="landing-kicker">ASÍ FUNCIONA TU MATRÍCULA</span><h3>Del pago a tu primer día, sin enredos.</h3></div><ol><li><b>01</b><span><strong>Elige tu plan</strong><small>30 días o programa completo.</small></span></li><li><b>02</b><span><strong>Realiza el pago</strong><small>En la pasarela segura.</small></span></li><li><b>03</b><span><strong>Revisa tu correo</strong><small>Recibirás la confirmación y el enlace.</small></span></li><li><b>04</b><span><strong>Completa tu ingreso</strong><small>Formulario inicial y acceso a tu plataforma.</small></span></li></ol></div>
    </section>

    <section className="landing-section access-section" id="ingresar">
      <div className="access-copy">
        <span className="landing-kicker">ACCESO A LA PLATAFORMA</span>
        <h2>Tu programa, tus avances y tu próxima acción, en un solo lugar.</h2>
        <p>Si ya pagaste y recibiste tu correo de bienvenida, ingresa con el correo y la contraseña asociados a tu cuenta. Tu formulario inicial aparecerá antes de entrar por primera vez.</p>
        <ul><li>Los alumnos ven su entrenamiento, nutrición y avance.</li><li>Profesionales y administración acceden según su rol registrado.</li><li>Tu tipo de perfil se valida automáticamente con el correo autorizado.</li></ul>
      </div>
      <form className="login-card" action="/signin-with-chatgpt" method="get">
        <input type="hidden" name="return_to" value="/plataforma" />
        <img src="/proyecto-90-logo-transparente.png" alt="" />
        <span className="landing-kicker">INGRESO SEGURO</span>
        <h3>Entrar a Proyecto 90</h3>
        <label>Tipo de usuario<select name="perfil" defaultValue="participant"><option value="participant">Alumno</option><option value="professional">Profesional</option><option value="admin">Administrador</option></select></label>
        <div className="chatgpt-access"><b>Correo de acceso y contraseña</b><span>En la siguiente pantalla podrás ingresar tus credenciales de forma segura.</span></div>
        <button type="submit">Ingresar con correo y contraseña <span>→</span></button>
        <small>Proyecto 90 no ve ni guarda tu contraseña.</small>
      </form>
    </section>

    <section className="landing-final-cta">
      <img src="/proyecto-90-logo-transparente.png" alt="Proyecto 90" />
      <div><span className="landing-kicker">90 DÍAS PARA CONSTRUIR TUS HÁBITOS</span><h2>El programa está diseñado para terminar.<br/><em>Los hábitos, para continuar.</em></h2></div>
      <a className="landing-primary" href="#valores">Matricularme ahora</a>
    </section>

    <footer className="landing-footer"><img src="/proyecto-90-logo-transparente.png" alt="Proyecto 90"/><p>Proyecto 90 × Tu Amigo el Moya × Firme</p><span>© 2026 Proyecto 90</span></footer>
  </main>;
}

function PillarIcon({type}:{type:"training"|"nutrition"|"habits"}) {
  if(type==="training") return <div className="pillar-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 18v12M14 14v20M34 14v20M40 18v12M14 24h20"/></svg></div>;
  if(type==="nutrition") return <div className="pillar-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="25" cy="25" r="13"/><path d="M25 12c1-5 5-7 9-7M8 11v26M5 11v10h6V11M40 11v26M37 11v10h6"/></svg></div>;
  return <div className="pillar-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 8a16 16 0 1 0 15 11M32 7h9v9"/><path d="m17 24 5 5 10-11"/></svg></div>;
}
