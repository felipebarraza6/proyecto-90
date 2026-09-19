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

`Dockerfile` compila la SPA y la sirve con nginx, proxyeando `/api` hacia el
contenedor de Yggdra (`yggdra-api:8000`, configurable en `nginx-spa.conf`).
