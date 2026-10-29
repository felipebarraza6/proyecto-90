# Cómo contribuir

## Ramas

| Rama | Rol |
|------|-----|
| `main` | Rama por defecto. El push dispara el deploy del sitio. |
| `dev` | Se mantiene alineada con `main` y el workflow no publica desde ella. |
| Ramas de feature | PR hacia `main`. El PR corre la verificación y no sube archivos. |

La rama de documentación de este estándar es `docs/estandar`. No se mergea sola.

## Pull requests

1. Crea la rama desde la rama por defecto (o desde `dev` en la API, según la tabla de arriba).
2. Un PR, un tema. Si tocas el producto y la documentación, que se note en el título.
3. Completa `.github/PULL_REQUEST_TEMPLATE.md`.
4. No subas secretos, `.env` con valores, ni dumps de base.
5. No cambies workflows de deploy, variables de producción ni secretos de Actions en un PR de documentación.

## Issues

- Bug o mejora de **este** cliente: ábrela en este repo, con las plantillas de `.github/ISSUE_TEMPLATE`.
- Bug o cambio de la **API Ginnung** (endpoints, permisos, contrato, datos de sucursal): ábrelo en [felipebarraza6/yggdra_infra](https://github.com/felipebarraza6/yggdra_infra/issues/new/choose) y pide la etiqueta `front:proyecto-90`.
- Si conoces la sucursal, escribe en el cuerpo `Sucursal: <id>`. Así el etiquetado automático de `yggdra_infra` puede mapearla (`docs/ISSUE_FRONT_LABELS.md` y `docs/BRANCH_FRONTS.yaml`).

## Estilo

Documentación en español de Chile, con tuteo o impersonal. Sin voseo.

Los nombres de variables de entorno se documentan solos. Los valores viven en el gestor de secretos o en un `.env` local que no se commitea.
