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

`.github/workflows/deploy-front.yml` publica la SPA en **Cloudflare Pages** con subida directa (API token + `wrangler`). El sitio `https://90dias.habitofirme.app` está detrás de Cloudflare; el FTPS anterior a `ftp.habitofirme.app` quedó fuera de DNS y ya no se usa.

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

`docs/CONSUMERS.yaml` registra el dominio `90dias.habitofirme.app` y que el deploy sale de `production`. Hay un fork nombrado en ese inventario: `marcelomoyavallejos-dotcom/proyecto-90`.

El `Dockerfile` puede servir la SPA con nginx. No es el camino del sitio público.

## Relación con la API Ginnung

Fetch manual a `/api/p90/*`, `/api/app`, `/api/files`, `/api/accounts/*` y `/api/public/*`, y a coaching cuando el flujo lo usa. No hay tipos generados ni `contract.yml`.

Modelo que ya usa el cliente:

- Participantes: `customers.Client` de la sucursal, usuario tipo cliente y perfil fitness.
- Coaches y nutricionistas: `employees.Employee` con rol de sucursal `COACH` o `NUTRICIONISTA`.
- Intake, rutinas, nutrición, adherencia y checkpoints: app `coaching`.

La ruta de recuperación de contraseña del cliente está en `src/pages/ResetPassword.tsx`.

Id de consumidor y etiqueta de issues de backend: `front:proyecto-90`.


El chequeo reutilizable está en [docs/CONTRACT_CHECK.md](https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md) y en `.github/workflows/contract-check.yml` de `yggdra_infra`. Corre en el runner del VPS, compara el `schema_sha256` de `https://api.yggdra.cl/api/schema/contract/` con el sha commiteado en el front, regenera tipos desde el freeze de `api/schema/openapi.yaml` y exige `tsc --noEmit`.

En la rama por defecto de este repo **no hay** un workflow `contract.yml` que llame ese chequeo. El inventario `docs/CONSUMERS.yaml` del backend describe el estilo de consumo de cada app.

## Enlaces

- Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Notas de QA del panel: [docs/panel-semanal-qa.md](docs/panel-semanal-qa.md)
- API Ginnung: https://github.com/felipebarraza6/yggdra_infra
- Deploy del front visto desde el backend: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/DEPLOY_PROYECTO90.md
- Chequeo de contrato: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md
- Sitio: https://90dias.habitofirme.app
