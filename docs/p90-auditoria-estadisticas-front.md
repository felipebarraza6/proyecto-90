# Auditoría: estadísticas fijas en el front (Proyecto 90)

Inventario de números, umbrales, colores, cortes, pesos, fórmulas y textos con cifras que afectan lo que se **calcula** o se **muestra** como estadística. Objetivo: que Marce pueda configurarlos desde Reglas sin tocar código.

**Fuente de verdad:** contrato GET/PATCH `/api/p90/panel/config` del backend PR yggdra_infra #80 (migraciones 0009 + 0010). El front no inventa campos: solo usa los del contrato, con los defaults del contrato cuando un campo no llega.

**Estado en este PR (front #4):** Reglas editable vía PATCH con todas las secciones y campos del contrato (etiquetas/ayudas en español para coach). Validación local según rangos del contrato. Donde había hardcode y ahora existe campo, el front lee config.

---

## Campos del contrato (resumen)

| Grupo | Campos |
|---|---|
| Fórmula / semáforo | `habit_weights`, `adherence_equal_weights_as_40_40_20`, `partial_day_policy`, `missing_day_policy`, `thresholds.*`, `percent_decimals`, `summary_avg_mode`, `no_data_counts_as_risk`, `status_multi_badge` |
| Macros | `macro_met_requires`, `macro_ranges`, `calories_min_enabled`, `calories_low_ratio`, `calories_low_alert_enabled`, `goal_resolution`, `macros_source` |
| Entreno / agua / tiempo | `allow_student_rest`, `rest_day_counts`, `default_sessions_per_week`, `training_mode`, `default_water_goal_ml`, `week_start_weekday`, `timezone`, `report_grace_hours`, `challenge_length_days`, `show_after_challenge_end`, `block_length_days`, `prorate_partial_weeks`, `training_alert_closed_weeks_only` |
| Alertas / análisis | `min_days_for_analysis`, `min_days_per_metric`, `alert_min_affected_days`, `missing_alert_min_days` |
| Hitos / cuerpo | `milestone_days`, `milestone_windows`, `weight_min_kg`, `weight_max_kg`, `height_min_cm`, `height_max_cm` |
| Comentarios / acceso | `comment_delete_policy`, `comment_visible_to_participant_default`, `notify_participant_on_comment`, `duplicate_window_seconds`, `comment_max_length`, `professional_scope`, `reviewer_access` |
| UI / IA | `panel_enabled`, `show_summary_cards`, `show_email_in_table`, `ai_summary_enabled`, `ai_temperature`, `ai_max_tokens`, `ai_timeout_s` |
| Solo lectura | `can_comment`, `config_version` |

No se exponen proveedor, modelo ni clave de la IA. No hay rankings ni rachas en el backend: el front local reutiliza `alert_min_affected_days` / `missing_alert_min_days` (+ gracia) para las alertas de `/api/app`.

---

## 1. Fórmula y semáforo

| Dónde | Valor (default contrato) | ¿De config? | Campo |
|---|---|---|---|
| Defaults + `ParticipantArea` | Pesos 1/1/1; con `adherence_equal_weights_as_40_40_20` → 40/40/20 en Participantes/hitos | Sí | `habit_weights`, `adherence_equal_weights_as_40_40_20` |
| `Legend`, Progreso, directorio | Texto de fórmula | Sí (`habitWeightsFormulaText`) | mismos |
| Panel / `normalizePanelConfig` | Verde > 80, amarillo ≥ 70, riesgo < 70 | Sí | `thresholds.*` |
| `professional-tracking` `bandOf` | Lee `thresholds` (fallback histórico 90/80 si no hay config) | Sí | `thresholds` |
| `%` | Decimales | Sí | `percent_decimals` |
| Políticas de día / promedio | `reported_only` / `exclude` / `per_student` | Sí (cálculo en backend) | `partial_day_policy`, `missing_day_policy`, `summary_avg_mode` |
| `PeopleTable` color adherencia | Rojo si &lt; **40** | No | fuera de contrato (no inventar campo) |

---

## 2. Macros

| Dónde | Default | ¿De config? | Campo |
|---|---|---|---|
| Rangos | kcal ≤ 110 %; prot ≥ 90 %; carbs/grasas 90–110 % | Sí | `macro_ranges` |
| ✓ macros | calories + protein | Sí | `macro_met_requires` |
| Mínimo kcal | off / 0,80 | Sí | `calories_min_enabled`, `calories_low_ratio`, `calories_low_alert_enabled` |
| Evaluación diaria | `macrosDayStatus` / `macroTone` con config | Sí | mismos |
| Banda amarilla “blanda” (±10 % del borde) | Fija en front | No | fuera de contrato |
| Meta del día | `per_day` | Sí | `goal_resolution` |
| Origen macros | `computed_then_manual` | Sí | `macros_source` |

---

## 3. Entreno, agua y calendario

| Dónde | Default | ¿De config? | Campo |
|---|---|---|---|
| Sesiones / agua | 3 / 2000 ml | Sí | `default_sessions_per_week`, `default_water_goal_ml` |
| Descanso alumno | false / `exclude` | Sí | `allow_student_rest`, `rest_day_counts` |
| Modo entreno | `auto` | Sí | `training_mode` |
| Semana / TZ / gracia | lun (0) / America/Santiago / 0 h | Sí | `week_start_weekday`, `timezone`, `report_grace_hours` |
| Largo del desafío | **90** días | Sí | `challenge_length_days` |
| Selects de semana (adherencia, nutrición, Mi Semana) | ceil(días/7) | Sí (`challengeWeeks`) | `challenge_length_days` |
| Bloque / prorrateo / post-fin | 30 / true / false | Sí | `block_length_days`, `prorate_partial_weeks`, `show_after_challenge_end` |
| Máx. 6 descansos en editor de plan | Fijo UI | No | fuera de contrato |

---

## 4. Alertas locales (`adherence-alerts` / panel Adherencia)

| Dónde | Default | ¿De config? | Campo |
|---|---|---|---|
| Racha “en riesgo” (consecutivos en rojo) | 2 | Sí (reuso local) | `alert_min_affected_days` |
| “Falta reportar” | 1 día (+ gracia en horas) | Sí | `missing_alert_min_days`, `report_grace_hours` |
| Copy del panel / dashboard pro | Dinámico con esos valores | Sí | mismos |
| Alertas del panel semanal (`AnalysisPanel`) | Backend | Parcial | `min_days_*`, `training_alert_closed_weeks_only`, etc. |

El backend **no** expone rachas: el umbral local de consecutivos es el mismo campo `alert_min_affected_days`.

---

## 5. Hitos y datos corporales

| Dónde | Default | ¿De config? | Campo |
|---|---|---|---|
| `progress-milestones`, `StudentFacts` | [30, 60, 90] + ventanas | Sí | `milestone_days`, `milestone_windows` |
| Validación peso / estatura | 30–300 kg / 100–230 cm | Sí | `weight_*`, `height_*` |
| Editor admin `weightDay30/60/90` | Campos de API fijos | Parcial (rangos sí; nombres de campo API fijos) | rangos de peso |

---

## 6. Análisis IA

| Dónde | Default | ¿De config? | Campo |
|---|---|---|---|
| Flag + temperatura / tokens / timeout | false / 0,3 / 400 / 15 | Sí (sin proveedor/modelo/clave) | `ai_summary_enabled`, `ai_*` |
| Umbral “parcial” del análisis | 3 días | Sí | `min_days_for_analysis` |

---

## 7. Fuera de PanelConfig (no cablear)

| Dónde | Valor | Nota |
|---|---|---|
| Agenda reunión alumno | 48 h de anticipación | Producto, no estadística / sin campo en #80 |
| `macroTone` banda blanda 10 % | Presentación | Sin campo |
| Colores CSS / factores kcal 4·4·9 | Visual / fisiología | n/a |
| `PeopleTable` &lt; 40 | Distinto de `thresholds.risk` | No inventar |

---

## Secciones de Reglas (UI)

1. Fórmula y semáforo  
2. Comentarios y acceso  
3. Medidas corporales  
4. Macros  
5. Entreno y descansos  
6. Agua y calendario del desafío  
7. Alertas  
8. Hitos  
9. Análisis IA  

Todas editables por admin vía PATCH; errores 400/403 del backend se muestran en español.
