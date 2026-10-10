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

El sitio https://90dias.habitofirme.app se publica desde `main` con el workflow
`.github/workflows/deploy-front.yml` (también se puede disparar a mano con
`workflow_dispatch`).

1. `npm ci` → `npm run lint` → `npm run check:panel` → `npm run build`
2. Build con `VITE_API_BASE=https://api.yggdra.cl` (URL de la API de producción;
   no es secreto; es la misma que usa el paquete manual).
3. Salida: `dist/client` (`vite.config.ts` → `outDir: "dist/client"`).
4. Subida por **FTPS** (TLS 1.2) a `ftp.habitofirme.app`, directorio remoto
   `90dias.habitofirme.app/`: primero todo menos `index.html`, después
   `index.html`. No se borran archivos remotos ajenos al build.

### Secretos de GitHub Actions

En el repo: **Settings → Secrets and variables → Actions**, crear:

| Secreto | Valor |
|---|---|
| `FTP_SERVER` | Hostname FTP, p. ej. `ftp.habitofirme.app` |
| `FTP_USERNAME` | Usuario FTP (p. ej. `90dias@habitofirme.app`) |
| `FTP_PASSWORD` | Contraseña FTP |
| `FTP_REMOTE_DIR` | (opcional) Ruta relativa al home del usuario. Vacío o `.` = raíz del jail (típico para cuenta cPanel del subdominio). Solo usa `90dias.habitofirme.app` si el usuario es la cuenta principal (como FileZilla). También se acepta la variable de repo `FTP_REMOTE_DIR`. |

Sin `FTP_SERVER` / `FTP_USERNAME` / `FTP_PASSWORD` el job falla en «Validar
secretos FTP».

**Diagnóstico (sin publicar):** Actions → Deploy Front (90dias) → Run workflow →
`mode=diagnose`. Lista el home y candidatos de path; no sube archivos. Se puede
correr desde una rama distinta de `main`. El deploy real solo corre en `main`.

`dev` se mantiene en el mismo commit que `main` y no despliega.

El panel de staff vive en `app/weekly-panel`. `panel_enabled` de la API no
apaga esa pantalla. `npm run check:panel` forma parte de `npm run build`.

`Dockerfile` también puede servir la SPA con nginx y proxy a Yggdra. El sitio
público no usa ese camino.
