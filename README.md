# Proyecto 90 días

## Qué es

Cliente del desafío de 90 días (Proyecto 90). Desde la versión 2.0 el backend vive en la API Ginnung, app Django `coaching`. Este repo es la SPA: landing, inscripción, seguimiento del participante y panel del equipo.

## A quién sirve

Participantes del programa y el equipo (administración, coaches y nutricionistas) de la sucursal Proyecto 90. Sitio: https://90dias.habitofirme.app.

## Stack

React 19, TypeScript, Vite 8, Tailwind. Tests con el runner de Node. npm y `package-lock.json`. El workflow usa Node 22. Hay un `Dockerfile` y `nginx-spa.conf` para servir la SPA con proxy hacia Yggdra. El sitio público no usa ese camino.

## Cómo correr en local

```bash
npm ci
npm run dev
```

Vite queda en http://localhost:5173 y el proxy de desarrollo manda `/api` a http://localhost:8000. Hace falta la API Ginnung.

El seed de la sucursal, los roles (`P90_ADMIN`, `COACH`, `NUTRICIONISTA`), los programas y el administrador se corren en el contenedor de Yggdra con `python manage.py seed_proyecto90`. Los argumentos y el correo del admin están en el historial del README anterior y en el propio comando (`--help`). No repitas contraseñas en issues.


## Variables de entorno

Solo nombres. Copia el ejemplo a un archivo local y completa los valores ahí. No los commitees ni los pegues en un issue.

| Nombre | Uso |
|--------|-----|
| `VITE_API_BASE` | Origen de la API, sin el sufijo `/api` en el valor que inyecta el workflow de producción |

En el build de GitHub Actions el workflow fija `VITE_API_BASE` en la API pública de Yggdra (`https://api.yggdra.cl`). En local, si no está definida, el proxy de Vite cubre `/api`.


## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Vite |
| `npm run check:panel` | El panel de staff sigue en el build |
| `npm run build` | Corre `check:panel` y genera `dist/client` |
| `npm run preview` | Previsualiza el build |
| `npm run lint` | ESLint, ignora `dist` |
| `npm test` | `node --test` sobre `tests/**/*.test.mjs` |

`panel_enabled` de la API no apaga la pantalla del panel. `app/weekly-panel` forma parte del build.


## Deploy

`.github/workflows/deploy-front.yml` publica la SPA en **Cloudflare Pages** con subida directa (API token + `wrangler`). El sitio `https://90dias.habitofirme.app` vive detrás de Cloudflare.

| Disparo | Qué hace |
|---------|----------|
| Pull request | Lint, `check:panel`, tests y build. No publica |
| Push a `production` | El mismo build y `wrangler pages deploy` de `dist/client` |
| `workflow_dispatch` con `mode=diagnose` | Valida secretos y lista proyecto, últimos deployments y dominios. Puede correr desde otra rama. No publica |
| `workflow_dispatch` con `mode=deploy` | Publica solo si la ref es `production` |

Solo la rama `production` publica. `main` y `dev` no.

`public/_redirects` da el fallback SPA: rutas profundas como `/reset`, `/checkout/result` y `/checkout/<id>` devuelven `index.html` con 200, y los assets existentes tienen prioridad. `public/_headers` deja el shell con `Cache-Control: no-cache` y `/assets/*` inmutable por un año. El build usa `VITE_API_BASE=https://api.yggdra.cl`.

Nombres de secretos y de la variable opcional, sin valores:

| Nombre | Uso |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Token con permiso `Cloudflare Pages:Edit` sobre la cuenta (más `Account:Read` para listar proyectos) |
| `CLOUDFLARE_ACCOUNT_ID` | Id de la cuenta de Cloudflare |
| `CF_PAGES_PROJECT` (variable de repo) | Nombre del proyecto de Pages. Si falta, `.github/scripts/resolve-pages-project.sh` lo detecta por dominio o por nombre |

Antes de publicar conviene correr `mode=diagnose` desde Actions: resuelve el proyecto, muestra los últimos 3 deployments y el estado del dominio.

El inventario de consumidores es del backend: [`docs/CONSUMERS.yaml` de `yggdra_arq`](https://github.com/felipebarraza6/yggdra_arq/blob/dev/docs/CONSUMERS.yaml). Su ficha de `proyecto-90` registra el dominio `90dias.habitofirme.app` y el fork `marcelomoyavallejos-dotcom/proyecto-90`; su campo `deploy` todavía dice `main`/`ftp` (desactualizado). La fuente de verdad del deploy es este repo: Cloudflare Pages desde `production`.

El `Dockerfile` puede servir la SPA con nginx. No es el camino del sitio público.

## Relación con la API Ginnung

Fetch manual a `/api/p90/*`, `/api/app`, `/api/files`, `/api/accounts/*` y `/api/public/*`, y a coaching cuando el flujo lo usa. El consumo es manual, pero el repo mantiene tipos generados en `src/lib/api/types/yggdra.d.ts` (se regeneran con `npm run sync-contract`) y un workflow `contract.yml` que compara el contrato.

Modelo que ya usa el cliente:

- Participantes: `customers.Client` de la sucursal, usuario tipo cliente y perfil fitness.
- Coaches y nutricionistas: `employees.Employee` con rol de sucursal `COACH` o `NUTRICIONISTA`.
- Intake, rutinas, nutrición, adherencia y checkpoints: app `coaching`.

La ruta de recuperación de contraseña del cliente está en `src/pages/ResetPassword.tsx`.

Id de consumidor y etiqueta de issues de backend: `front:proyecto-90`.


El chequeo reutilizable está en [docs/CONTRACT_CHECK.md](https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md) y en `.github/workflows/contract-check.yml` de `yggdra_infra`. Corre en el runner del VPS, compara el `schema_sha256` de `https://api.yggdra.cl/api/schema/contract/` con el sha commiteado en el front, regenera tipos desde el freeze de `api/schema/openapi.yaml` y exige `tsc --noEmit`.

En este repo, `.github/workflows/contract.yml` corre en cada push (todas las ramas) y por `workflow_dispatch`. Hace checkout y ejecuta `.github/scripts/check-contract-sha.sh`, que compara el `schema_sha256` vivo de `https://api.yggdra.cl/api/schema/contract/` con el `YGGDRA_SCHEMA_SHA` de `src/lib/api/contract-sha.ts`; no regenera tipos ni corre `tsc`. El chequeo completo (`npm ci`, `sync-contract`, `tsc --noEmit`) corre en `yggdra_arq` (antes `yggdra_infra`), en `.github/workflows/contract-fronts.yml`, porque el runner del VPS está registrado solo en ese repo.

## Enlaces

- Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Notas de QA del panel: [docs/panel-semanal-qa.md](docs/panel-semanal-qa.md)
- API Ginnung: https://github.com/felipebarraza6/yggdra_infra
- Deploy del front visto desde el backend: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/DEPLOY_PROYECTO90.md
- Chequeo de contrato: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md
- Sitio: https://90dias.habitofirme.app
