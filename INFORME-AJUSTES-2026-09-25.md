# Informe de entrega — Ajustes plataforma Proyecto 90 Días

**Fecha de entrega en producción:** 26-09-2026  
**Origen:** documento `Ajustes plataforma 90 días 25092026.docx` (Marcelo + sugerencias Felipe)  
**Producto:** Proyecto 90 Días · https://90dias.habitofirme.app · API https://api.yggdra.cl  

---

## 1. Resumen ejecutivo

Todas las mejoras pedidas por Marcelo en el documento del 25-09-2026 quedaron implementadas en SPA + API, validadas con tests y **desplegadas en producción**. WhatsApp Business real quedó fuera a propósito (canal acordado: in-app + correo).

| # | Pedido de Marcelo | Estado en producción |
|---|---|---|
| 1 | % de cumplimiento con días completados (no solo transcurridos) | ✅ |
| 2 | Hitos día 30 / 60 / 90 por tramos (1–30, 31–60, 61–90) | ✅ |
| 3 | Comentarios one-way (admin/coach/nutri → alumno), visibles al alumno | ✅ |
| 4 | Seguimiento legible en celular (admin/coach/nutri) | ✅ |
| 5 | Sesiones: admin asigna profesional y le aparece en su panel Sesiones | ✅ |
| 6 | Nutri puede pausar macros el 1er mes; alumno no los ve; % sin macros | ✅ |
| 7 | Guía nutricional PDF visible para el alumno + biblioteca de materiales | ✅ |
| 8 | Avisos a quienes no cargaron el día (in-app + correo) | ✅ |
| 9 | Día 1 parte al aprobar rutina **y** macros | ✅ |

---

## 2. Pedido vs. evidencia de implementación

### 2.1 Porcentajes e hitos 30 / 60 / 90

**Pedido:** *“Los porcentajes de cumplimiento deberían ir calculándose con los días completados, no con los transcurridos… el 30 debería ser el promedio del 0 al día 30, el 60 del 30 al 60 y el 90 del 60 al 90.”* (captura con hitos en 0% pese a ~89% semanal)

**Qué se hizo**
- Causa del 0%: el bootstrap calculaba adherencia viva pero publicaba el valor guardado en `Checkpoint` (a menudo 0/vacío).
- Nueva fórmula en `adherence.py` / `bootstrap.py`:
  - Denominador = **días con registro** del componente (entreno / agua / macros).
  - Hito 30 = ventana días 1–30; hito 60 = 31–60; hito 90 = 61–90.
  - Se publica siempre el cálculo **vivo** en `adherence_day_30/60/90`.
- SPA: copy del panel de hitos actualizado (“tramos 1–30 / 31–60 / 61–90 · días con registro”).

**Evidencia**
- Tests: `TestAdherenciaVentanasYDiasCompletados`
- Código: `api/apps/coaching/services/adherence.py`, `bootstrap.py`
- SPA: `app/progress-milestones.tsx`

---

### 2.2 Comentarios del equipo hacia el alumno (no chat)

**Pedido:** comentarios de nutri/coach visibles en el panel del alumno; solo profesionales + admin escriben; el alumno solo lee.

**Qué se hizo**
- Modelo `ClientNote` cableado con `author_role` y `visible_to_participant`.
- Acciones `note.create` / `note.delete`.
- Bootstrap staff y alumno incluyen `notes`.
- SPA: panel en ficha profesional/admin; sección **Comentarios** en el nav del alumno.

**Evidencia**
- Tests: `TestComentariosYMacrosDiferidosYDia1.test_note_create_visible_to_participant`
- SPA: `app/notes-notices.tsx` + integración en `functional-app.tsx`

---

### 2.3 Seguimiento mal formateado en celular

**Pedido:** pantalla Seguimiento “rara” / mal formato en móvil (admin, coach, nutri).

**Qué se hizo**
- Ajustes CSS en `professional-tracking` / `globals.css`: filtros en columna, héroe sin solapes, score debajo del nombre bajo 620/720px.

**Evidencia**
- Archivo: `app/globals.css` (media queries de tracking)
- Bundle de producción incluye esos estilos (`index-CoiUigeR.css`)

---

### 2.4 Sesiones asignadas al profesional

**Pedido:** desde admin agregar el profesional a cargo; que le salga en su apartado Sesiones.

**Qué se hizo**
- Campo `LiveSession.professional_user` (FK al usuario del profesional).
- Formulario SPA: select “Profesional a cargo” con la lista de profesionales.
- Bootstrap del coach: solo sus sesiones; admin ve todas.

**Evidencia**
- Tests: `TestSesionAsignadaAProfesional`
- Migración `0004_p90_ajustes_2509` (columna aplicada en prod)

---

### 2.5 Pausar macros (importante clínico)

**Pedido:** botón para no gestionar macros el primer mes; el participante no ve macros hasta que la nutri los libere; el % considera solo entrenamiento y agua.

**Qué se hizo**
- Campo `ClientFitnessProfile.macros_tracking` = `active` | `deferred`.
- Acción `macros.tracking.set` (nutri + admin).
- Si `deferred`: alumno sin plan/tracker de macros (`macrosVisible: false`); adherencia **50% entreno + 50% agua**.
- SPA: botón “Pausar macros / Liberar macros” + banner en Alimentación.

**Evidencia**
- Tests: `test_macros_deferred_hides_nutrition_for_participant`
- Modelos verificados en prod: `macros_tracking=True`

---

### 2.6 Biblioteca + guía nutricional PDF visible

**Pedido:** el admin adjunta PDF pero el alumno no lo ve; se necesita biblioteca (PDF, imágenes, links/videos).

**Qué se hizo**
- `ContentItem` con `file_key` / `file_kind` (pdf, image, link, video).
- `/api/files` acepta `purpose=content` (PDF e imágenes) además de la guía nutricional.
- Alumno en **Aprender**: bloque “Guía nutricional” + materiales publicados; también botón PDF en Alimentación cuando aplica.

**Evidencia**
- Modelos en prod: `file_key=True`
- SPA: modal Contenido con upload + vista Aprender

---

### 2.7 Avisos a quienes no cargaron el día

**Pedido (Felipe OK):** avisos automáticos; canal acordado = **in-app + correo** (no WhatsApp Business).

**Qué se hizo**
- Modelo `ClientNotice` + acción `notice.read`.
- Comando `notify_missing_daily` (crea aviso + email).
- Cron en VPS: todos los días a las **22:30** (hora del servidor):
  ```
  docker exec api-prod-api python manage.py notify_missing_daily --branch 33
  ```
  (branch id 33 = Proyecto 90 Días en producción)
- SPA: panel de avisos en Inicio del alumno.

**Evidencia**
- Cron instalado en root@137.184.152.245
- Dry-run operativo tras hotfix de filtro `business_name`
- Commit hotfix prod: `a8a5f268`

---

### 2.8 Día 1 al aprobar rutina y macros

**Pedido (Felipe OK):** que el día 1 parta solo cuando se aprueben la rutina y los macros.

**Qué se hizo**
- Al crear alumno, `challenge_start` queda vacío.
- En `training.review` y `nutrition.review`: si **ambas** áreas están aprobadas y no hay fecha, se fija `challenge_start = hoy`.
- Admin puede seguir editando la fecha a mano.
- Cohorte ya existente con fecha seteada **no se modifica**.

**Evidencia**
- Tests: `test_participant_create_leaves_challenge_start_empty`, `test_dual_approval_sets_challenge_start`
- SPA copy: “Tu desafío inicia cuando coach y nutri aprueben tu plan”

---

## 3. Validación técnica

| Chequeo | Resultado |
|---|---|
| `pytest apps/coaching/tests/test_coaching.py` (Docker) | **48/48** |
| Migración `0004_p90_ajustes_2509` en producción | **Aplicada** (`showmigrations` [X]) |
| Modelos en prod (`macros_tracking`, `ClientNotice`, `professional_user`, `file_key`, `author_role`) | **Presentes** |
| Contenedor `api-prod-api` | **healthy** |
| `GET https://api.yggdra.cl/ping/` | **200** `{"status":"ok"}` |
| SPA live | `index-JLY0Kbaz.js` + `index-CoiUigeR.css` · asset **200** · Content-Length 373475 |
| GitHub Actions Deploy Front (push a `main`) | **success** |
| Cron `notify_missing_daily --branch 33` | **Instalado** (22:30 diario) |

---

## 4. Commits y despliegue

### Backend `yggdra_infra` (branch `production`)
| SHA | Descripción |
|---|---|
| `776d5bc8` | feat(coaching): ajustes 25-09 (hitos, notas, macros, sesiones, día 1) |
| `d8884cde` | style(coaching): black format for CI gate |
| `a8a5f268` | fix(coaching): notify_missing_daily filtra por business_name |

Deploy VPS: `DEPLOY_MODE=deploy DEPLOY_BRANCH=production` · backup `yggdra_prod_20260926T031215Z.sql.gz` · mensaje Deploy OK.

### Frontend `proyecto-90` (branch `main`)
| SHA | Descripción |
|---|---|
| `b12370d` | feat(p90): ajustes UI 25-09 — comentarios, macros pausa, sesiones, hitos, biblioteca |

Deploy: FTP automático vía workflow **Deploy Front (90dias)**.

---

## 5. Decisiones conscientes (no son incumplimientos)

1. **WhatsApp Business** no se integró: requiere Meta Cloud API / Twilio, plantillas y costo. Quedó in-app + correo.
2. **Push Hábito Firme** sigue fuera de alcance (SSO pendiente).
3. **Cohorte actual** con `challenge_start` ya fijado conserva su reloj; la regla “día 1 al doble-aprobar” aplica a altas nuevas o perfiles sin fecha.
4. Con macros diferidos, el peso del % es **50% entreno / 50% agua** (claridad clínica).

---

## 6. Cómo verificar en la app (checklist para Marcelo)

1. **Admin / alumno ≥ día 30:** hitos 30/60/90 muestran % del tramo (no 0% fantasma si hay registros).
2. **Coach o nutri:** en la ficha del alumno, publicar un comentario → el alumno lo ve en **Comentarios**.
3. **Admin:** crear sesión eligiendo “Profesional a cargo” → ese coach la ve en **Sesiones**.
4. **Nutri:** “Pausar macros” → el alumno ve el aviso y no el tracker; al liberar, vuelve.
5. **Admin:** adjuntar guía PDF o publicar contenido → el alumno la abre en **Aprender** / Alimentación.
6. **Alumno nuevo:** sin día 1 hasta que coach **y** nutri aprueben; luego arranca el reloj.
7. **Celular:** abrir **Seguimiento** y confirmar layout sin solapes.

---

## 7. Conclusión

Las mejoras del documento de Marcelo del **25-09-2026** están **entregadas y en producción** en Proyecto 90 Días (SPA + API), con evidencia de tests, migración, healthchecks, assets live y cron de avisos diarios.
