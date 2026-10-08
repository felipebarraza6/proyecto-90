# Checklist QA — panel semanal «Adherencia y seguimiento»

Repo del cliente: no se agregó Vitest. El chequeo `npm run check:panel` impide volver a usar `panel_enabled` como interruptor de la pantalla. Verificar a mano contra la API.

Viewports: **1440 px** (tabla) y **375 px** (tarjetas + ficha a pantalla completa). Roles: Admin, Coach, Nutri.

| # | Caso | Cómo verificar | ✔ |
|---|---|---|---|
| 1 | Semana 21–27 sep: Hugo Loyola y Eugenio Ponce **no** aparecen; en 5–11 oct sí | Selector de semana + filas | ☐ |
| 2 | Filtros En riesgo / Falta reportar correctos en una semana pasada | Semana 28 sep–4 oct: contadores = filas | ☐ |
| 3 | Inicio a mitad de semana: días previos = «No iniciado», no cuentan | Raul (inicio 3/10) en 28 sep–4 oct | ☐ |
| 4 | Semana en curso: días futuros = «Día futuro», no faltan | Semana actual | ☐ |
| 5 | Estados distintos (No cumplió / Sin reportar / No iniciado / Día futuro / Cumplió / Hoy / Descanso / No aplica) | Ficha + leyenda | ☐ |
| 6 | Semáforo: 80 amarillo, 80,1 verde, 70 amarillo, 69,9 rojo | Chip de % (el front no calcula; confirma el color del backend) | ☐ |
| 7 | Alerta de entrenos con frecuencia ≠ 4 (p. ej. 3/semana) | Ficha → Alertas: «2 de 3» | ☐ |
| 8 | Alumno sin registros: «Sin datos suficientes», sin concluir incumplimiento | Alumno recién iniciado | ☐ |
| 9 | Comentario de la nutri visible para coach y admin, en Comentarios del alumno, en otra semana; **no** en otro alumno | 3 sesiones + «Ver como» participante | ☐ |
| 10 | Doble clic en Enviar no duplica; un envío fallido conserva el borrador | DevTools offline / doble clic | ☐ |
| 11 | Error del análisis: mensaje + Reintentar + fecha del último análisis | Forzar error o `refresh=1` | ☐ |
| 12 | Panel usable en móvil y escritorio | 375 px y 1440 px | ☐ |
| + | Abrir ficha desde el nombre, la fila o un %; misma semana; cambio de alumno recarga todo | Clics en tabla / tarjetas | ☐ |
| + | Menú: una sola entrada «Adherencia y seguimiento»; «Adherencia en riesgo» abre con filtro risk; «Abrir seguimiento →» abre el panel | Admin y profesional | ☐ |
| + | Con `panel_enabled=false` el menú de staff sigue en «Adherencia y seguimiento» y la ficha abre | Recargar la SPA con el flag en false | ☐ |
| + | Participante no ve el panel (403 en `/api/p90/panel/config`) | Login alumno | ☐ |
| + | Borrador por alumno (`localStorage` `p90_draft_{staffUserId}_{clientId}`), sin mezcla | Escribir en A, abrir B, volver a A | ☐ |
| + | Vacío: «Ningún alumno había iniciado en esta semana»; filtro sin match; «Aún no hay comentarios» | Semana futura / filtro / ficha nueva | ☐ |
| + | Carga: skeleton; error de red: Reintentar en panel, ficha, análisis y comentarios | DevTools offline | ☐ |

## Notas

- El front **no** recalcula `%` ni colores: pinta `pct`, `color`, `state` y umbrales de `/config`.
- Comentarios: POST con `client_request_id` (uuid); 200 `duplicate:true` se trata como éxito; 409 muestra error y conserva el texto.
- Reintentar análisis llama `GET .../analysis?refresh=1`.
