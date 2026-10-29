#!/usr/bin/env node
/**
 * Plantilla tomada de frig/scripts/sync-contract.mjs.
 * Regenera los tipos del front desde el freeze de yggdra_infra.
 *
 * Fuente (en este orden):
 *   - YGGDRA_SCHEMA_YML
 *   - ../yggdra_infra/api/schema/openapi.yaml
 *
 * El sha sale de meta.json al lado del YAML (schema_sha256).
 * No descarga el schema desde la URL pública.
 *
 * Escribe:
 *   src/lib/api/types/yggdra.d.ts
 *   src/lib/api/contract-sha.ts
 *
 * Uso: npm run sync-contract
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SIBLING_SCHEMA = resolve(REPO_ROOT, "../yggdra_infra/api/schema/openapi.yaml");
const SIBLING_META = resolve(REPO_ROOT, "../yggdra_infra/api/schema/meta.json");
const OUT_TYPES = resolve(REPO_ROOT, "src/lib/api/types/yggdra.d.ts");
const OUT_SHA = resolve(REPO_ROOT, "src/lib/api/contract-sha.ts");

function writeContractSha(sha) {
  if (!/^[0-9a-fA-F]{64}$/.test(sha)) {
    throw new Error(`schema_sha256 inválido: ${sha}`);
  }
  writeFileSync(
    OUT_SHA,
    `// GENERADO POR sync-contract (scripts/sync-contract.mjs), no editar.
// Re-generar con: npm run sync-contract
export const YGGDRA_SCHEMA_SHA = "${sha.toLowerCase()}";
`,
  );
}

function generateTypes(schemaPath) {
  const cli = resolve(REPO_ROOT, "node_modules/openapi-typescript/bin/cli.js");
  if (!existsSync(cli)) {
    throw new Error("Falta openapi-typescript. Instálalo (devDependency) y corre npm ci.");
  }
  mkdirSync(dirname(OUT_TYPES), { recursive: true });
  execFileSync(process.execPath, [cli, schemaPath, "-o", OUT_TYPES], {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
}

function main() {
  const schemaOverride = process.env.YGGDRA_SCHEMA_YML?.trim();
  const schemaPath = schemaOverride ? resolve(schemaOverride) : SIBLING_SCHEMA;
  const metaPath = schemaOverride ? resolve(dirname(schemaPath), "meta.json") : SIBLING_META;

  if (!existsSync(schemaPath)) {
    throw new Error(
      `No está el openapi.yaml fijado (${schemaPath}). Define YGGDRA_SCHEMA_YML o clona yggdra_infra al lado. No se usa la URL pública.`,
    );
  }
  if (!existsSync(metaPath)) {
    throw new Error(`No está meta.json junto al freeze (${metaPath}).`);
  }

  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const sha = meta.schema_sha256;
  if (!sha) throw new Error("meta.json no trae schema_sha256");

  console.log(`[sync-contract] Freeze: ${schemaPath}`);
  generateTypes(schemaPath);
  writeContractSha(sha);
  console.log(`[sync-contract] OK -> ${OUT_TYPES} y ${OUT_SHA} (${sha})`);
}

main();
