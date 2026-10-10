# Continuidad de Proyecto 90 Días

Este directorio es el que se publica. Un push a `main` dispara Deploy Front
(`.github/workflows/deploy-front.yml`) y sube la SPA a
https://90dias.habitofirme.app. `dev` tiene que quedar en el mismo commit que
`main`.

No trabajes en `C:\Users\SH\projects\proyecto-90` ni en
`C:\Users\SH\projects\p90-0710`. El deploy necesita los secretos de Actions
`FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD` (FTPS a `ftp.habitofirme.app`).

El panel de staff es `app/weekly-panel` (ficha por alumno y análisis). No recrees `app/weekly-team-panel.tsx`. No uses `panel_enabled` para mostrar u ocultar esa pantalla: en la API llega en false y eso devolvía al usuario a la adherencia vieja. `npm run check:panel` corta el build si eso vuelve.

No reviertas `main` para sacar una pantalla. Si hay que corregir, corrige hacia adelante en este repo y publica `main`.
