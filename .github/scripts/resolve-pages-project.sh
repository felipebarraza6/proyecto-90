#!/usr/bin/env bash
# Resuelve el proyecto de Cloudflare Pages donde vive 90dias.habitofirme.app.
#
# Salida: SOLO el nombre del proyecto por stdout, sin adornos, para poder usarlo
# como PROJECT="$(.github/scripts/resolve-pages-project.sh)".
# Logs, candidatos y errores van a stderr. Nunca imprime el token.
#
# Orden de resolución:
#   1. CF_PAGES_PROJECT (vars.CF_PAGES_PROJECT) si viene con valor.
#   2. Proyecto cuyo array `domains` incluya 90dias.habitofirme.app.
#   3. Un único proyecto con subdominio *.pages.dev y nombre con "90" o "habitofirme".
#   4. Cualquier otro caso: lista nombre → dominios y sale con código 3.
#
# Requiere: CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.

set -euo pipefail

TARGET_DOMAIN="90dias.habitofirme.app"

log() { printf '%s\n' "$*" >&2; }

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  log "ERROR: falta CLOUDFLARE_API_TOKEN."
  exit 1
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  log "ERROR: falta CLOUDFLARE_ACCOUNT_ID."
  exit 1
fi

if [ -n "${CF_PAGES_PROJECT:-}" ]; then
  log "Proyecto de Pages tomado de CF_PAGES_PROJECT: ${CF_PAGES_PROJECT}"
  printf '%s\n' "$CF_PAGES_PROJECT"
  exit 0
fi

log "CF_PAGES_PROJECT vacío; autodetectando el proyecto en la cuenta ${CLOUDFLARE_ACCOUNT_ID}…"

API_URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects?per_page=50"

RESP="$(curl -fsS --max-time 30 \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "$API_URL")" || {
  log "ERROR: no se pudo consultar ${API_URL}"
  exit 1
}

# Parseo con node (ya está en el runner) para no depender de jq.
set +e
PARSED="$(printf '%s' "$RESP" | node -e '
let raw = "";
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  const target = "90dias.habitofirme.app";
  const emit = (lines) => process.stdout.write(lines.join("\n") + "\n");
  const list = (projects) => projects.map((p) => {
    const domains = Array.isArray(p.domains) ? p.domains : [];
    return "CANDIDATE\t" + String(p.name || "(sin nombre)") + "\t" + (domains.length ? domains.join(", ") : "(sin dominios)");
  });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    emit(["ERROR\tla lista de proyectos no es JSON válido"]);
    process.exit(2);
  }
  if (!body || body.success === false) {
    const errs = body && Array.isArray(body.errors) ? JSON.stringify(body.errors) : "sin detalle";
    emit(["ERROR\tla API respondió success=false: " + errs]);
    process.exit(2);
  }

  const projects = Array.isArray(body.result) ? body.result : [];
  console.error("Proyectos visibles en la cuenta: " + projects.length);

  const byDomain = projects.filter((p) => Array.isArray(p.domains) && p.domains.includes(target));
  if (byDomain.length === 1) {
    emit(["OK\t" + byDomain[0].name]);
    return;
  }
  if (byDomain.length > 1) {
    emit(["AMBIGUOUS"].concat(list(byDomain)));
    process.exit(3);
  }

  const byName = projects.filter((p) => {
    const sub = typeof p.subdomain === "string" ? p.subdomain : "";
    return sub.endsWith(".pages.dev") && /(90|habitofirme)/i.test(String(p.name || ""));
  });
  if (byName.length === 1) {
    emit(["OK\t" + byName[0].name]);
    return;
  }

  emit(["AMBIGUOUS"].concat(list(byName.length > 0 ? byName : projects)));
  process.exit(3);
});
')"
NODE_RC=$?
set -e

if [ "$NODE_RC" -eq 0 ]; then
  PROJECT="$(printf '%s\n' "$PARSED" | head -n 1 | cut -f2-)"
  if [ -z "$PROJECT" ]; then
    log "ERROR: el parser no devolvió el nombre del proyecto."
    exit 2
  fi
  log "Proyecto de Pages detectado: ${PROJECT}"
  printf '%s\n' "$PROJECT"
  exit 0
fi

if [ "$NODE_RC" -eq 3 ]; then
  log ""
  log "No se pudo determinar el proyecto de Cloudflare Pages sin ambigüedad."
  log "Candidatos (nombre → dominios):"
  if printf '%s\n' "$PARSED" | awk -F'\t' '$1=="CANDIDATE"' | grep -q .; then
    printf '%s\n' "$PARSED" | awk -F'\t' '$1=="CANDIDATE" {printf "  %s → %s\n", $2, $3}' >&2
  else
    log "  (ninguno)"
  fi
  log ""
  log "Define la variable de repo CF_PAGES_PROJECT con el nombre exacto del proyecto y vuelve a correr."
  exit 3
fi

log "ERROR: falló el parseo de la lista de proyectos."
printf '%s\n' "$PARSED" | awk -F'\t' '$1=="ERROR" {printf "  %s\n", $2}' >&2
exit 2
