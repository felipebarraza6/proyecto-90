# Auditoría: estadísticas fijas en el front (Proyecto 90)

Inventario de números, umbrales, colores, cortes, pesos, fórmulas y textos con cifras que afectan lo que se **calcula** o se **muestra** como estadística. Objetivo: que Marce pueda configurarlos desde Reglas sin tocar código.

**Config actual (PR backend #80 / GET·PATCH `/api/p90/panel/config`):**  
`thresholds`, `percent_decimals`, `habit_weights`, `partial_day_policy`, `missing_day_policy`, `macro_met_requires`, `macro_ranges`, `calories_min_enabled`, `calories_low_ratio`, `calories_low_alert_enabled`, `goal_resolution`, `summary_avg_mode`, `allow_student_rest`, `rest_day_counts`, `default_water_goal_ml`, `default_sessions_per_week`, `training_mode`, `show_summary_cards`, `show_email_in_table`, `ai_summary_enabled`, `config_version` (solo lectura).

Leyenda de la columna «Campo config»: nombre del campo existente, o `falta en backend`.

**Estado en este PR (front #4):** donde el campo ya existe en PanelConfig, el front deja de hardcodear y lee la config (default = valor histórico). Reglas organizada en secciones: Fórmula y semáforo · Macros · Entreno y descansos · Agua · Alertas · Hitos · Análisis IA.

---

## 1. Fórmula y semáforo

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `panelConfig.ts` defaults + fallback adherencia total en `functional-app.tsx` (ParticipantArea) | Pesos 0,4 / 0,4 / 0,2 (40 % entreno · 40 % macros · 20 % agua) | Sí | `habit_weights` |
| `Legend.tsx`, métrica Progreso, `ParticipantDirectory` | Texto de fórmula con cifras | Sí (`habitWeightsFormulaText`) | `habit_weights` |
| `panelConfig.ts` / `normalizePanelConfig` | Semáforo verde > 80, amarillo ≥ 70, riesgo < 70 | Sí (panel usa `config.thresholds`) | `thresholds.green_gt`, `thresholds.yellow_gte`, `thresholds.risk` |
| `professional-tracking.tsx` `bandOf` | Histórico: rojo &lt; 80, amarillo 80–90, verde &gt; 90 | Sí (lee `thresholds`; sin config mantiene defaults 90/80) | `thresholds` |
| `format.ts` `formatPct` + `PanelStatsContext` | Decimales del % | Sí | `percent_decimals` |
| `panelConfig.ts` | `partial_day_policy` / `missing_day_policy` / `summary_avg_mode` defaults `exclude` / `exclude` / `days_with_pct` | Sí (Reglas + defaults; el cálculo vive en backend) | mismos nombres |
| `PeopleTable` color adherencia | Rojo si &lt; **40** | No (distinto de `thresholds.risk`) | `falta en backend` (o unificar a `thresholds.risk`) |
| `functional-app.tsx` / hitos / cierre | Desafío de **90** días; **13** semanas en selects | No | `falta en backend` (p. ej. `challenge_days`, `challenge_weeks`) |
| Semana = **7** días (varios) | Longitud de semana | No (implícito) | `falta en backend` (si alguna vez debe variar) |

---

## 2. Macros

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `panelConfig.ts` defaults | kcal ≤ 110 %; proteína ≥ 90 %; carbs/grasas 90–110 % | Sí (defaults) | `macro_ranges` |
| Cumplimiento ✓ solo kcal+proteína | Lista fija histórica | Sí | `macro_met_requires` |
| Mínimo kcal off; piso 90 % | `false` / `0.9` | Sí | `calories_min_enabled`, `calories_low_ratio`, `calories_low_alert_enabled` |
| `nutrition-daily.tsx`, `participant-adherence.tsx`, `adherence-alerts.ts`, `adherence-panel.tsx`, `daily-closure.tsx`, `ProfessionalTracking` → `NutritionDailyReview` | Evaluación vía `macrosDayStatus` / `macroTone` con `panelConfig` | Sí | mismos |
| `panelConfig.ts` `macroTone` | Banda amarilla si se desvía ≤ **10 %** del borde del rango | No | `falta en backend` (p. ej. `macro_soft_band_ratio`) |
| `goal_resolution` default `daily` | Cómo se elige la meta del día | Sí (backend; UI en Reglas) | `goal_resolution` |

---

## 3. Entreno y descansos

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `HabitPlanEditor` / create participante | Sesiones default **3**; rango UI 1–7 | Sí | `default_sessions_per_week` |
| `Fields` `trainingDays` | Default días disponibles | Sí (`panelConfig.default_sessions_per_week` ?? 3) | `default_sessions_per_week` |
| `allow_student_rest` default false | Botón D del alumno | Sí | `allow_student_rest` |
| `rest_day_counts` default `exclude` | Cómo cuenta el D | Sí (leyenda / backend) | `rest_day_counts` |
| `training_mode` default `sessions_per_week` | Modo de plan | Sí | `training_mode` |
| Máx. 6 días de descanso en editor | `prev.length >= 6` | No | `falta en backend` (opcional) |

---

## 4. Agua

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `HabitPlanEditor` / defaults | Meta agua **2000** ml (2 L) | Sí | `default_water_goal_ml` |
| `formatMlAsLiters` | Mostrar en L con hasta 2 decimales | No (formato UI) | n/a o `falta` si se quiere configurar precisión |

---

## 5. Alertas (front local vs panel backend)

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `adherence-alerts.ts` `hasThreeConsecutiveMisses` | Racha de **3** días `missed` → riesgo | No | `falta en backend` (p. ej. `alert_miss_streak`) |
| `adherence-alerts.ts` cutoff | Falta reportar si ≥ **2** días atrás (texto «48 h») | No | `falta en backend` (p. ej. `alert_missing_hours` / `alert_missing_days`) |
| `adherence-panel.tsx` copy | «3 incumplimientos» y «48 horas» | No | mismos (cuando existan) |
| `functional-app.tsx` `countRiskyParticipants` | Misma racha **3** | No | `alert_miss_streak` |
| Dashboard profesional | «Macros en rojo 3 días» / «Sin registro +48 h» | No | mismos |
| `calories_low_alert_enabled` | Alerta calorías bajas | Sí (sección Alertas en Reglas) | `calories_low_alert_enabled` |
| Alertas del **panel semanal** (`AnalysisPanel`) | Códigos/umbrales vienen del backend | Parcial | varios del #80; más campos pendientes en backend |

---

## 6. Hitos

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `progress-milestones.tsx` | Días **0 / 30 / 60 / 90** | No | `falta en backend` (p. ej. `milestone_days: [30,60,90]`) |
| Texto fórmula hitos | Tramos **1–30 / 31–60 / 61–90** · días con registro | No (copy; cálculo en backend) | `falta en backend` + alinear con `summary_avg_mode` / pesos |
| `StudentFacts` milestones | Mismos 30/60/90 | No | `milestone_days` |

---

## 7. Análisis IA

| Dónde | Valor fijo | ¿Ya de config? | Campo config |
|---|---|---|---|
| `ai_summary_enabled` | Flag en config | Sí (Reglas · sección Análisis IA) | `ai_summary_enabled` |
| `AnalysisPanel` | Muestra «IA» si `summary_engine === "llm"` | Indirecto | `ai_summary_enabled` (+ faltan umbrales de cobertura/refresh en backend) |
| Cobertura «días con registro» | Umbral `insufficient` en backend | No en front | `falta en backend` |

---

## 8. Otros (display / producto, no siempre «estadística»)

| Dónde | Valor fijo | Notas | Campo config |
|---|---|---|---|
| `restored-panels.tsx` reunión | Anticipación mínima **48 h** | Agenda, no adherencia | `falta` o fuera de alcance estadístico |
| `formatKg` | 1 decimal | Presentación | opcional |
| Colores CSS verde/ámbar/rojo | Tokens visuales | No son umbrales numéricos | n/a |
| Factores kcal 4/4/9 | Energía de macros | Fisiología, no PanelConfig | n/a |

---

## Acciones de este PR (front)

1. Documentar este inventario (`docs/p90-auditoria-estadisticas-front.md`).
2. Donde el campo **ya existe** en PanelConfig: dejar de hardcodear y leer config (defaults = valor actual).
3. Pantalla Reglas organizada en secciones: **Fórmula y semáforo**, **Macros**, **Entreno y descansos**, **Agua**, **Alertas**, **Hitos**, **Análisis IA** (las tres últimas con aviso «pendiente de campos en backend» hasta que #80 los agregue).

Cuando el backend publique el contrato ampliado, mapear cada fila `falta en backend` a un campo nuevo y exponerlo en la sección correspondiente.
