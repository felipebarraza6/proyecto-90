# Informe de ajustes — Plataforma Proyecto 90

**Fecha:** 24-09-2026 · **Origen:** documento "Ajustes plataforma 90 días" (Marcelo, equipo cliente)
**Alcance:** SPA `proyecto-90` (dev) + backend Yggdra `apps.coaching` (dev) — ambos repos con cambios aplicados y validados, sin commitear.

---

## 1. Lo que pidió Marcelo vs. lo que se hizo

### Perfil Admin

**1) "No me da contraseñas provisorias para los profesionales" + "no alcanzo a copiar la contraseña"**
- **Hecho (backend):** `professional.create` y `admin.create` ahora **envían la contraseña temporal por correo** al profesional (nuevo `send_professional_credentials` en `credentials_email.py`, usa la misma plantilla HTML que los alumnos) y devuelven `tempPassword` en la respuesta.
- **Hecho (SPA):** al crear participante, profesional o administrador aparece un **diálogo persistente "Accesos Proyecto 90"** con el correo y la contraseña temporal, botones **Copiar** por campo, **"Copiar mensaje para WhatsApp"** y aviso si el correo no pudo enviarse. Ya no depende de un toast de 2,6 segundos.
- **Hecho:** botón **"Restablecer acceso"** en la pantalla Profesionales (admins y coach/nutricionista): genera contraseña nueva y la envía por correo — nueva acción `credentials.resend` (solo admin; rechaza participantes).

**2) "Por la fecha no puedo probar que quienes ingresan después del 01-10-2026 tengan 90 días desde ese día"**
- Verificado: el reloj ya funciona así (`resolve_challenge_start`: matrícula en septiembre → día 1 = 1 de octubre; matrícula posterior → día 1 = fecha de alta). Test `test_resolve_challenge_start_rules` lo cubre.
- Lo que faltaba era poder **mover la fecha para probar**: resuelto en el punto siguiente.

**3) "Debería poder modificar la fecha de inicio de los alumnos (día 1)"**
- **Hecho (backend):** `participant.update` acepta `challengeStart` (solo admin; valida formato AAAA-MM-DD). Test: fecha futura → alumno queda en día 0; fecha inválida → rechazada.
- **Hecho (SPA):** en la ficha del alumno (modal "Ficha") hay un bloque **"Fecha de inicio del desafío (día 1)"** con selector de fecha y botón guardar. Además el "Día actual" de la ficha ahora usa `challenge_start` (antes usaba `assigned_at`, inconsistente).

**4) "0% cumplimiento pero no ha empezado el plan"**
- **Hecho (SPA):** en Seguimiento → Cumplimiento individual, los alumnos con día 0 entran a una banda nueva **"Aún no inicia"** (neutra) y **ya no aparecen como "Necesita apoyo"**. El héroe muestra "—" con "aún no inicia" + nota explicando cuándo parte su desafío. La tabla de participantes muestra "Sin iniciar" en lugar de 0% rojo. Las alertas de riesgo ya excluían días previos al inicio (verificado).
- El cálculo backend (`enrich_adherence`) ya marcaba `adherence_elapsed_days: 0`; ahora la SPA lo usa.

**5) "Crear sesión me exige link de YouTube y conferencia"**
- Auditado: el backend y la SPA actuales **no exigen** enlaces (el test `test_coach_can_delete_a_session` ya creaba sesiones sin ellos); probablemente lo vio en el build antiguo.
- **Hecho:** etiquetas ahora dicen **"Enlace en vivo (opcional)"** y **"Grabación YouTube (opcional)"** con placeholder "Puedes agregarlo después", y hay test de regresión nuevo: crear sin enlaces → 200, agregarlos después con `session.update` → guardados.

**6) "Registro de quiénes no tienen actividades cargadas al cierre del día"**
- **Hecho (SPA):** nuevo panel **"Cierre del día"** en Adherencia (admin) y Seguimiento (coach/nutricionista): elige una fecha y ve por alumno, dentro de su reloj de 90 días, si reportó **entreno** y/o **macros** (✓ Reportado / ✗ No cumplió / — Sin registrar), filtro "Solo sin registrar", contadores y botón **"Copiar resumen"** (lista lista para pegar en WhatsApp). Usa los registros diarios que ya carga la API; no requiere backend nuevo.

### Perfil Nutricionista

**7) "Agregar la estatura al lado del peso en la ficha"**
- **Hecho:** la estatura (`ClientFitnessProfile.height`, pedida en el intake) ahora se muestra en: ficha del profesional (junto a Peso inicial/Último peso), modal de nutrición, tarjeta nutricional (NutritionCard) y ficha del admin. No hizo falta tocar el backend (ya lo enviaba).

### Perfil Coach

**8) "Asignar más de una rutina por persona (gym + casa básica), primaria y emergencia"**
- **Hecho (backend):** nuevo campo `ClientEnrollment.kind` (`primary` / `emergency`, migración `0003_clientenrollment_kind`). `program.assign` acepta `kind:"emergency"`: **la de emergencia reemplaza solo a la emergencia anterior y convive con la principal** (no resetea la aprobación del coach). El bootstrap del staff expone `emergency_program_id/name` y el del alumno entrega ambas guías con `kind`.
- **Hecho (SPA):** en la ficha del coach hay **dos selectores** (Rutina principal + Rutina de emergencia) y pestañas para ver cada guía. El alumno ve en Entrenamiento las pestañas **"Mi rutina principal"** y **"Emergencia · para entrenar en casa"** cuando tiene ambas asignadas (siempre que su plan esté aprobado, igual que hoy).

### Versión celular

**9) "En la parte superior de la Landing no sale para iniciar sesión"**
- **Hecho:** el CSS ocultaba `.p90-login` bajo 720px. Ahora el header móvil muestra **"Ingresar"** junto a "Matricúlate" (etiqueta corta en móvil, larga en escritorio). **Validado con captura del build de producción a 390×844.**

### Fórmula matemática

**10) "A la alumna (caso Ljubica) le dejaron las calorías del GET siendo su objetivo bajar grasa"**
- **Causa encontrada:** si la alumna marca "Disminuir porcentaje de grasa" **y** "Aumentar masa muscular" (objetivo combinado), el motor aplicaba **0% de ajuste** → las calorías quedaban exactamente en el GET.
- **Hecho (backend):** `goal_adjustment_pct` ahora es `loss: -15%, gain: +10%, combined: -10%` → bajar grasa **siempre** produce déficit; el objetivo combinado sigue marcando revisión de la nutricionista y ella puede ajustar a mano como siempre.
- **Para el caso puntual:** los planes ya calculados no se recalculan solos. Correr en producción: `python manage.py recalculate_nutrition_proposals` (crea propuesta nueva pendiente de aprobar; no toca planes aprobados).

### Perfil alumno (móvil)

**11) "El calentamiento y los circuitos no se ajustan a la pantalla"**
- **Causa:** las tablas de rutina tenían `min-width: 620px` con scroll horizontal en móvil.
- **Hecho:** en la vista del alumno, bajo 900px la tabla se ajusta al ancho completo; bajo 620px calentamiento y circuitos se transforman en **tarjetas apiladas** con el rótulo de cada columna (datos `data-label` agregados a `GuideTable`). Sin scroll horizontal. La vista admin/coach mantiene su formato de tabla.

---

## 2. Validación de las correcciones

| Validación | Resultado |
|---|---|
| `pytest apps/coaching/tests/test_coaching.py` en Docker (BD de test recreada) | **43/43 pasan** (incluye 13 tests nuevos de este informe) |
| Migración `0003_clientenrollment_kind` aplicada en la BD del stack light | OK (columna `kind` verificada) |
| `npm run build` (Vite) | OK |
| `npm run lint` | 3 errores + 3 warnings **todos preexistentes** (idénticos a HEAD; este trabajo no agrega ninguno) |
| `npx tsc --noEmit` | 8 errores **preexistentes** (idénticos a HEAD; el build de producción no ejecuta tsc) |
| Preview del build de producción a 390×844 | "Ingresar" visible en el header de la landing (captura verificada) |
| Paquete de despliegue `deploy-90dias/` | Resincronizado con el build nuevo (`VITE_API_BASE=https://api.yggdra.cl`, igual que el paquete anterior) |

**Tests nuevos:** `TestCredencialesProfesionales` (4), `TestFechaInicioEditable` (3), `TestRutinaEmergencia` (4), `TestSesionesSinEnlaceObligatorio` (1), `TestObjetivoCombinado` (2). Archivo: `api/apps/coaching/tests/test_coaching.py`.

---

## 3. Archivos modificados

**SPA `proyecto-90` (branch `dev`):**
- `app/functional-app.tsx` — diálogo de credenciales, restablecer acceso, fecha de inicio editable, estatura, rutina primaria/emergencia (coach y alumno), "Sin iniciar" en tabla, etiquetas de sesión opcionales, copy del formulario de participante, Cierre del día montado en Adherencia/Seguimiento.
- `app/professional-tracking.tsx` — banda "Aún no inicia" ≠ "Necesita apoyo".
- `app/daily-closure.tsx` — **nuevo**, panel Cierre del día.
- `app/routine-guide.tsx` — `data-label` para las tarjetas móviles.
- `app/restored-panels.tsx` — estatura en NutritionCard.
- `app/landing.tsx` — etiqueta corta de login en móvil.
- `app/globals.css` — landing móvil, tablas de rutina en móvil, estilos de componentes nuevos.
- `deploy-90dias/` — paquete reconstruido (no versionado en git).

**Backend `yggdra_infra` (branch `dev`):**
- `api/apps/coaching/services/actions.py` — credenciales por correo + `tempPassword`, `credentials.resend`, `challengeStart` en `participant.update`, `kind` en asignación de programas.
- `api/apps/coaching/services/credentials_email.py` — `send_professional_credentials`.
- `api/apps/coaching/services/bootstrap.py` — rutina de emergencia en bootstrap staff y `kind` en bootstrap alumno.
- `api/apps/coaching/services/nutrition_engine.py` — déficit para objetivo combinado.
- `api/apps/coaching/models/coaching.py` + `migrations/0003_clientenrollment_kind.py` — campo `kind`.
- `api/apps/coaching/tests/test_coaching.py` — 13 tests nuevos.

No se tocó nada de los cambios pendientes de inventory/recipes que existían en el workspace.

---

## 4. Deuda / pasos pendientes para producción

**Despliegue (operación, no código):**
1. Backend: deploy de Yggdra y aplicar migración en producción → `python manage.py migrate coaching` (aditiva, sin riesgo para datos).
2. Reiniciar/recargar la API para servir el código nuevo.
3. Subir el paquete `deploy-90dias/` por FTP (ya quedó construido y apuntando a `api.yggdra.cl`).
4. Caso Ljubica: correr `python manage.py recalculate_nutrition_proposals` para que la nutricionista revise la propuesta con déficit.
5. Verificar que el SMTP/Resend de producción esté enviando (si un correo falla, la contraseña queda visible y copiable en el diálogo, con aviso).

**Deuda técnica real (para el backlog):**
1. **Quitar rutina de emergencia**: hoy se puede reemplazar pero no retirar. Falta acción `program.unassign` (backend) + botón (SPA).
2. **Aprobación separada por tipo de rutina**: la emergencia se publica junto con la aprobación del plan principal; no existe aprobación independiente por rutina.
3. **Cierre del día es un reporte en la SPA**: no hay snapshot nocturno ni notificaciones automáticas (WhatsApp/push) de quién no cargó. Si Marcelo quiere aviso automático, es un job backend nuevo.
4. **Historial de contraseñas entregadas**: el diálogo no registra quién copió/reenvió; solo queda el correo enviado y el `updated_by` del usuario.
5. **SPA:** 8 errores de TypeScript y 3 de ESLint preexistentes (no bloquean el build); conviene limpiarlos y agregar `tsc --noEmit` al pipeline.
6. **Motor nutricional:** el déficit del objetivo combinado (−10%) es una decisión clínica por defecto; la nutricionista puede ajustarlo caso a caso. Si Marcelo quiere otro porcentaje, es una línea en `nutrition_engine.py`.

---

## 5. Despliegue a producción — ejecutado 24/25-09-2026

**Backend (api.yggdra.cl, VPS 137.184.152.245):**
- Commits en `dev` (`e4b575fe`, `1e6dbfb5`) y backport a `production` (`8c8a2d37`, `f931747d`, `14aedff0` con Black para el gate de CI).
- Suite de coaching validada contra el árbol de production antes del push: **43/43**.
- CI de GitHub (`backend-baseline` + `ai-agents-quality`) en verde para `production`.
- VPS: `git pull` a `14aedff0` → build de imágenes (api, celery_worker, celery_beat) → **migración `0003_clientenrollment_kind` aplicada** (verificada: columna `kind`) → contenedores recreados.
- Backup previo a la migración: `/opt/backups/p90-deploy-20260924/yggdra_prod_pre0003.sql.gz` (22 MB).
- Salud: `/health/` → `healthy` (db, redis, celery, storage); `/ping/` → 200.
- Nota: `api-prod-celery-*` muestran `unhealthy` cosmético por un healthcheck mal definido (curl a puerto 8000 dentro del worker); la salud real vía `/health/` es `celery: healthy, workers:1`.

**Front (90dias.habitofirme.app):**
- Repo: commit `9a39b38` en `dev` y `main` sincronizada (fast-forward).
- Paquete `deploy-90dias/` (build con `VITE_API_BASE=https://api.yggdra.cl`) subido por FTP a la carpeta `90dias.habitofirme.app` del hosting (primero assets, al final `index.html`). El `.htaccess` remoto se dejó intacto; los bundles antiguos quedan en el servidor como rollback inmediato.
- Verificación: `https://90dias.habitofirme.app` sirve el bundle nuevo (`index-CG8U3Dny.js` + `index-Bu6AE6rX.css`), assets por HTTPS 200 y **captura en móvil 390×844 confirmó "Ingresar" visible en el header**.

**Recalculo nutricional (caso Ljubica):**
- `recalculate_nutrition_proposals --branch "Proyecto 90" --force` ejecutado en producción: **propuesta nueva para Ljubica con 2200 kcal (déficit aplicado)**, queda pendiente de aprobación de la nutricionista. Los planes aprobados/editados no se tocaron (1 omitido, 1 sin cálculo por menor de edad — correcto).

**Pendiente para el backlog (no bloquea a Marcelo):** quitar rutina de emergencia (solo reemplazar hoy), aprobación independiente por tipo de rutina, notificaciones automáticas del Cierre del día, corregir el healthcheck de celery en compose, limpiar los 8 errores TS preexistentes de la SPA.

**CI/CD del front (agregado el 25-09-2026):** workflow `.github/workflows/deploy-front.yml` — al pushear/mergear a `main` (con cambios de front), GitHub Actions construye con `VITE_API_BASE=https://api.yggdra.cl` y sube por FTP con `lftp` (assets primero, `index.html` al final, sin borrar bundles viejos = rollback inmediato), y verifica el sitio con un curl al terminar. Credenciales en los secretos `FTP_HOST`/`FTP_USER`/`FTP_PASS`. Corrida inicial en verde (run 36091228054). Costo: ~2-3 min por deploy en la capa gratis de Actions. `dev` no deploya: main es producción.

---

## 6. Auditoría final de entrega (25-09-2026)

| # | Requerimiento de Marcelo | Estado | Verificación |
|---|---|---|---|
| 1 | Contraseñas provisorias de profesionales | ✅ Entregado | Correo automático + diálogo copiable + "Restablecer acceso"; tests backend; en producción |
| 2 | Copiar la contraseña al crear / ¿llega al correo? | ✅ Entregado | Diálogo persistente con copia por campo y mensaje WhatsApp; aviso si el correo falla |
| 3 | Probar que tras el 01-10-2026 cuentan 90 días desde ese día | ✅ Entregado | Regla verificada con tests (`resolve_challenge_start`); ahora puede mover la fecha a mano (ítem 5) |
| 4 | "Necesita apoyo" con 0% sin haber empezado | ✅ Entregado | Banda "Aún no inicia" en Seguimiento; "Sin iniciar" en tablas; alertas excluyen días pre-inicio |
| 5 | Modificar la fecha de inicio del alumno | ✅ Entregado | Editor de fecha en la ficha (solo admin); el día 1 automático sigue la regla de matrícula y se ajusta a mano |
| 6 | Sesiones sin YouTube/conferencia obligatorio | ✅ Entregado | Nunca fue obligatorio en el código actual; etiquetas "(opcional)" + test; se ven agendadas sin link |
| 7 | Registro de quiénes no cargaron al cierre del día | ✅ Entregado | Panel "Cierre del día" (Adherencia/Seguimiento) con filtro y copiar resumen |
| 8 | Estatura junto al peso (nutricionista) | ✅ Entregado | Ficha profesional, tarjeta nutricional, ficha admin y modal nutrición; responsive 2×2 en móvil |
| 9 | Rutina primaria + emergencia, alumno ve ambas | ✅ Entregado | Backend `kind` + migración en prod; selectores y pestañas para coach; pestañas para alumno |
| 10 | Login visible arriba en landing móvil | ✅ Entregado | "Ingresar" en el header móvil; verificado con captura en producción (390×844) |
| 11 | Ljubica: calorías quedaban en el GET sin déficit | ✅ Entregado | Causa: objetivo combinado aplicaba 0%; ahora −10% (loss −15%). Propuesta nueva en producción: 2200 kcal |
| 12 | Calentamiento y circuitos no ajustan en móvil | ✅ Entregado* | Tarjetas apiladas bajo 620px, sin scroll horizontal; verificado por build/CSS — **pendiente prueba visual con un alumno real en celular** |

**Acciones operativas antes de cerrar la entrega:**
1. La nutricionista debe abrir la ficha de Ljubica y **aprobar la propuesta nueva (2200 kcal)** — el sistema no publica planes sin aprobación profesional (diseño intencional).
2. Pedir a Marcelo (o un alumno beta) revisar la rutina en el celular (ítem 12), único ítem sin verificación visual end-to-end.

**Decisiones conscientes (no son incumplimientos):** el día 1 se ajusta a mano (Marcelo lo autorizó); automatizarlo al aprobar rutina+macros queda en backlog junto con: quitar rutina de emergencia, aprobación independiente por rutina y avisos automáticos del cierre del día.

**CI/CD validado end-to-end:** el último push a `main` disparó el deploy automático (run 36091706824, verde) y el sitio sirvió el bundle nuevo sin intervención manual.

---

## 7. Auditoría documento 28-09-2026 ("últimos gaps")

**Ya estaban entregados por los ajustes 25-09 (verificados en producción):**
| Ítem del doc | Estado |
|---|---|
| Comentarios a alumnos (fichas + sección Comentarios del alumno con autor/rol/fecha) | ✅ en prod |
| Pausar macros (deferred): alumno no los ve, 50% entreno / 50% agua, liberar reactiva | ✅ en prod |
| Guía nutricional PDF visible para el alumno (Aprender + Alimentación, permisos de descarga) | ✅ en prod |
| Recordatorio diario: aviso in-app + correo (`notify_missing_daily`) | ✅ comando listo |

**Gaps reales encontrados y corregidos el 28-09 (todo desplegado):**
1. **Comentarios y pausa en Seguimiento**: el comentario y el botón Pausar/Liberar macros estaban solo dentro de las fichas. Ahora también aparecen **al fondo del alumno seleccionado en Seguimiento** (admin con ambas; nutri con pausa; coach con comentarios).
2. **Contenido/Herramientas**: la sección admin se renombró y **coach y nutricionista ganaron su propia sección** para publicar links, PDFs y videos (el backend ya lo permitía; faltaba la UI).
3. **Móvil**: el nav inferior cortaba en 5 secciones — Aprender y Comentarios quedaban invisibles en el celular. Ahora se muestran **todas** (scroll horizontal si no caben).
4. **Textos de rutinas editables**: nuevo bloque "Textos e indicaciones del día" en el editor de rutinas (títulos de bloque y notas). Además se corrigió un bug del backend que **convertía los títulos en ejercicios** al editarlos.
5. **Recordatorio 22:30 programado**: tarea Celery + entrada de beat `p90-notify-missing-daily` (22:30 hora Chile), registrada en el scheduler y cargada por el worker (`apps.coaching.tasks` en el include de Celery).
6. **Filtro de semana**: el default ya era la semana actual según el día del alumno; se endureció para resincronizar si la fecha de inicio cambia (p. ej. día 1 fijado tras aprobar).

**CI de production**: venía rojo desde el backport 25-09 (un test de plan_checkout esperaba `challenge_start` al crear, comportamiento que ese ajuste cambió a propósito). Test alineado con la nueva semántica. Además se relanzó un fallo puntual de un test de suppliers (ajeno a estos cambios).

**Validación**: coaching 50/50 (dev y árbol production), plan_checkout 17/17, build+lint SPA en baseline, VPS healthy, beat con crontab `30 22 * * * America/Santiago`, front auto-desplegado (run verde del Action).

**Nota CI (fuera del alcance P90):** tras alinear el test de plan_checkout, el CI de production quedó revelando un fallo preexistente de `suppliers` (`test_mark_completed_from_received`, HTTP 500) introducido con el feature de recepción de OC del 24-09 — verificado que falla en un commit anterior a todos los cambios de Proyecto 90. Se deja como trabajo separado del equipo; no afecta a Proyecto 90 ni a su despliegue.
