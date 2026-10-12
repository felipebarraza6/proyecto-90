# Auditoría front P90 — 2026-10-12

**Estado follow-up:** gaps **arreglados** (rama `cursor/auditoria-gaps-fix-45eb`). Tests reales en `tests/auditoria-gaps.test.mjs`.

**Repo:** `felipebarraza6/proyecto-90` · **rama base:** `main` (= producción `90dias.habitofirme.app`)  
**Alcance:** solo auditoría (sin merge). Commits de referencia en `main`: `#7` `7eac8c9`, `#8` `2515da4`.  
**Método:** lectura estática de código + grep de literales + tests unitarios existentes. Sin llamadas live a `api.yggdra.cl` en este informe.

## Resumen ejecutivo

El panel semanal (tabla, tarjetas, ficha, resumen) **sí** toma % y colores del payload `GET /api/p90/panel/week` y `…/students/{id}/week`, y la pantalla **Reglas** hace PATCH parcial limpio. Los huecos que pueden explicar “algo no funciona” para Marce están en:

1. Tras guardar Reglas: mensaje de éxito se apaga al instante; lista `/weeks` y análisis de ficha no se invalidan con fuerza.
2. Pantallas **legado** (Participantes / tracking / alertas locales) usan **otros** números o umbrales (p. ej. tracking 90/80 si no hay config).
3. Roles: el revisor puede comentar aunque `reviewer_access` diga solo lectura.
4. Regresiones menores de `#7`/`#8`: altura `3≤n<min`, `planned=0`, ficha sin `formatHeightCm`.

No hay React Query ni SWR; el único `sessionStorage` del panel guarda semana/filtro/alumno, no la config.

---

## Tabla de hallazgos

| Feature | ¿Funciona? | Evidencia | Causa raíz | Propuesta de fix |
|---|---|---|---|---|
| Reglas: carga valores reales desde GET `/config` | **Sí** | `api.ts` `fetchPanelConfig` → `normalizePanelConfig`; `functional-app.tsx` carga al montar; `PanelConfigView.tsx:24-84` `toDraft` | — | — |
| Reglas: PATCH parcial solo claves dirty | **Sí** | `PanelConfigView.tsx:135-142` `buildPatch` | Objetos anidados (`thresholds`, `macro_ranges`, …) se envían enteros si cambió esa clave (correcto) | Mantener; no aplanar mal |
| Reglas: tipos/rangos cliente | **Sí** (con matices) | `validateDraft` `PanelConfigView.tsx:145-265`; enums solo por `<select>` | `timezone` solo “no vacío”; enums sin allowlist | Validar IANA / allowlist |
| Reglas: éxito visible tras guardar | **No** | `setOk(true)` `656` luego `onSaved` → `useEffect([config])` hace `setOk(false)` `547-555` | El refresh de config limpia el banner en el mismo ciclo | No limpiar `ok` si el draft coincide con lo guardado; o toast fuera del effect |
| Reglas: error 405/403/400 | **Sí** | `PanelConfigView.tsx:661-674` | — | — |
| Reglas → refresco semana/tabla/resumen | **Sí** | `WeeklyPanel.tsx:127-135` `setReload` → `fetchWeek` | — | — |
| Reglas → refresco lista de semanas | **No** | `fetchWeeks` solo en mount `WeeklyPanel.tsx:51-67` | Si cambian `challenge_length_days` / inicio de semana, el selector puede quedar viejo | Re-fetch `fetchWeeks` en `onSaved` |
| Reglas → refresco análisis ficha | **Parcial** | Al abrir Reglas se desmonta el drawer; al volver, `fetchAnalysis(..., refresh=false)` `StudentDrawer.tsx:129-131` | Análisis puede quedar cacheado en backend bajo reglas viejas | Forzar `refresh=true` tras cambio de config |
| Reglas: fallback si re-GET falla | **Riesgo** | `WeeklyPanel.tsx:129-134` catch conserva PATCH; `normalizePanelConfig` rellena defaults | Un body parcial mal interpretado como config completa | Fallar cerrado si re-GET falla; no sustituir por defaults |
| `panel_enabled` oculto pero en draft | **Sí (hoy no se envía)** | Draft `PanelConfigView.tsx:26`; sin Switch UI; dirty-only | Latente: podría colarse en un PATCH total futuro | Sacarlo de `Draft`/`buildPatch` |
| Semáforo panel (tabla/chips/ficha) | **Sí** | `WeeklyTable` / `ParticipantCards` / `StudentFacts` / `PercentChip` usan `config.thresholds` + `percent_decimals` | — | — |
| Fallback alignPct `80/70` literales | **Parcial** | `format.ts:110-111` `?? 80` / `?? 70` | Duplica defaults del contrato | Usar `PANEL_CONFIG_DEFAULTS.thresholds` |
| `chipAriaLabel` sin decimales/align | **No (a11y)** | `format.ts:236-242` | % de aria ≠ chip visible | Pasar `percent_decimals` + color |
| Leyenda macros sin `macro_ranges` | **Parcial** | `Legend.tsx:32` string hardcodeado 90/110 % | Fallback de copy ignora defaults tipados | `formatRangeHint(DEFAULTS.macro_ranges)` |
| Tracking profesional umbrales 90/80 | **No (si config null)** | `professional-tracking.tsx:13-14,80-86` | Defaults históricos ≠ contrato 80/70 | Usar `PANEL_CONFIG_DEFAULTS.thresholds` |
| Tracking / directorio `%` con `Math.round` | **Parcial** | `professional-tracking.tsx:28`; `restored-panels.tsx:22` | Ignora `percent_decimals` | `formatPct(..., percent_decimals)` |
| Participantes: % ≠ panel semana | **No (dos fuentes)** | `restored-panels.tsx:37` `p.adherence` de `/api/app` | No usa `/api/p90/panel/week` | Etiquetar “adherencia global” o enlazar panel |
| Alertas legado vs panel | **No (por diseño)** | `adherence-alerts.ts:105-163`; copy en `adherence-panel.tsx` | Streak local ≠ `status` del panel | Mantener copy claro; unificar a largo plazo |
| Pesos 40/40/20 / habit_weights | **Sí** | `habitWeightsFormulaText` + config | — | — |
| Macros met/ranges en panel path | **Sí** | `macrosDayStatus` / MacroMark + `macro_ranges` | — | — |
| Meta agua / sesiones default panel | **Sí** | `WeeklyPanel.tsx` pasa `default_water_goal_ml` / sessions al editor | — | — |
| Hitos 30/60/90 en ficha panel | **Sí** | `StudentFacts` usa `milestone_days` | — | — |
| Editar datos: pesos fijos día 30/60/90 | **No dinámico** | `body-data-editor.tsx:13-23,210-212` | UI no lee `milestone_days` | Generar campos desde config (+ API) |
| TZ hardcode `America/Santiago` | **Parcial** | `nutrition-daily.tsx:27`, `participant-adherence.tsx:23`, `functional-app.tsx` `chileTodayIso`, `format.ts:20` | Ignora `config.timezone` | Usar `panelConfig.timezone \|\| DEFAULTS` |
| Consistencia panel↔ficha↔resumen misma semana | **Sí** | Misma familia de endpoints panel; display-only `formatPct` | — | — |
| Admin edita Reglas | **Sí** | `WeeklyPanel.tsx:46,113-124` | — | — |
| Coach edita plan hábitos; no Reglas/body | **Sí** | `StudentDrawer.tsx:153-154`; body solo admin | — | — |
| Nutri ve ficha/macros; no plan hábitos | **Sí** | `canEditHabits` excluye nutrition | — | — |
| Revisor + `reviewer_access` | **No** | Comentarios si `can_comment` `StudentDrawer.tsx:238`; nunca lee `reviewer_access` | Front no aplica la regla | `canComment && reviewer_access !== "none"` y bloquear write si `"read"` |
| Habit plan `can_edit` API | **No usado** | Tipo en `types`; UI solo rol | — | Respetar `res.can_edit` |
| Layout móvil panel/ficha/reglas | **Sí (con riesgos)** | Cards &lt;768; tablas `overflow:auto`; drawer full | Mini-chips 7 días apretados | Compactar chips &lt;380px |
| `#7` align % vs color | **Sí** | `format.ts` `alignPctDisplay`; tests `pct-align.test.mjs` | — | — |
| `#7` altura m→cm | **Parcial** | `height.ts:36` solo `n < 3` | `5` o `5.9` se tratan como cm inválidos | Banda metros `n < 10` o detector; tests |
| `#7` altura en ficha | **Parcial** | `StudentFacts.tsx` usa `height_cm` crudo | No pasa por `formatHeightCm` | Unificar helper |
| `#8` Plan cumplido done≥planned | **Sí** | `trainingProgress.ts:26-28`; tests | — | — |
| `#8` planned=0 | **Parcial** | `trainingProgress.ts:26` exige `planned > 0` | Muestra `0 de 0` | Copy “Sin sesiones planificadas” |
| `#8` wording Reglas | **Sí** | Badges/staff/reviewer/Checkpoints/panel_enabled oculto | — | Seguir barrido en legado |
| Caché React Query/SWR | **N/A (no hay)** | `package.json` sin RQ/SWR; `fetch` `cache:"no-store"` en panel API | — | — |
| sessionStorage panel | **OK** | `usePanelWeek.ts` solo UI semana/filtro | No cachea config | — |

---

## Checklist Reglas (campos)

Todos los campos editables del formulario cargan vía `toDraft` desde `normalizePanelConfig` y salen en PATCH solo si dirty. Detalle ya revisado en código: pesos, semáforo, macros, entreno, agua, calendario, alertas, hitos, IA, comentarios, alcance corporal.

Excepción: **`panel_enabled`** sigue en draft (sin UI) — no se envía si no cambia.

---

## Tests de gaps (arreglados)

Archivo: `tests/auditoria-gaps.test.mjs` — asserts reales (ya no `todo`). Cubren defaults 80/70 + `formatPct`, `chipAriaLabel`, altura `[3,10)`, `planned=0`, preferencia `panel_week_pct`, `week_start_weekday`, macro defaults. También pasan `height`, `pct-align`, `training-progress`.

## Follow-up fix (2026-10-12)

Gaps de la tabla **arreglados** en `cursor/auditoria-gaps-fix-45eb`: Reglas (ok estable, weeks, analysis refresh, re-GET fail-closed, sin `panel_enabled` en draft), tracking 80/70 + `formatPct`, Participantes/`panel_week_pct`, Legend/format defaults, `reviewer_access` + `can_edit`, altura `[3,10)`, `formatHeightCm`, `planned=0`, body `milestone_days`, TZ, `week_start_weekday`, mini-chips &lt;380px.
