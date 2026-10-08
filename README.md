# Proyecto 90 — SPA

App del desafío de 90 días ("Tu Amigo el Moya"). Desde la versión 2.0 el
**backend completo vive en [Yggdra](../yggdra_infra)** (app Django
`apps.coaching`); este repo es solo la SPA (Vite + React 19).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173, proxy /api → http://localhost:8000
```

Requiere la API de Yggdra corriendo (`docker-compose.light.yml` en
`yggdra_infra/api/services`).

## Primer uso (seed)

En el contenedor de Yggdra:

```bash
python manage.py seed_proyecto90 --branch "Proyecto 90" --create-branch --admin-email admin@proyecto90.cl
```

Esto crea la sucursal, los roles (P90_ADMIN, COACH, NUTRICIONISTA), los 4
programas con sus guías (208 ejercicios), las 74 preguntas de intake y un
administrador con contraseña temporal.

## Roles y modelo de datos

- **Participantes** = `customers.Client` de la sucursal + `User` tipo cliente
  + perfil fitness (`ClientFitnessProfile`).
- **Coaches / nutricionistas** = `employees.Employee` + `User` con rol de
  sucursal `COACH` / `NUTRICIONISTA`.
- Intake, rutinas, nutrición, adherencia y checkpoints viven en la app
  `coaching` de Yggdra (`/api/app`, `/api/files`, `/api/export`).

## Producción

El sitio https://90dias.habitofirme.app sale de la rama `main` de
`marcelomoyavallejos-dotcom/proyecto-90`. GitHub Action «Deploy Front (90dias)»
compila con `VITE_API_BASE=https://api.yggdra.cl` y sube `dist/client` por FTP.
`dev` se mantiene en el mismo commit que `main` y no despliega.

El panel de staff vive en `app/weekly-panel`. `panel_enabled` de la API no
apaga esa pantalla. `npm run check:panel` forma parte de `npm run build`.

`Dockerfile` también puede servir la SPA con nginx y proxy a Yggdra. El sitio
público no usa ese camino.
