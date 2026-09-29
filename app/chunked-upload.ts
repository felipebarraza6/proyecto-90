// Subida de archivos a /api/files en partes.
// El proxy de producción rechaza requests de más de ~1 MB (413 sin CORS), así
// que los PDF grandes se envían en partes de 700 KB y el backend los arma.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const CHUNK_BYTES = 700 * 1024;

type UploadResult = { ok?: boolean; key: string; name?: string; fileKind?: string; planId?: number };

function uploadId() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return random.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48) || `u${Date.now()}`;
}

async function postPart(url: string, headers: Record<string, string>, form: FormData) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body: form });
  } catch {
    throw new Error("No se pudo conectar con el servidor para subir el archivo. Revisa tu conexión e intenta de nuevo.");
  }
  const raw = await response.text();
  let json: Record<string, unknown> = {};
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = {}; }
  if (!response.ok) {
    const fallback = response.status === 413 ? "El archivo es demasiado grande para el servidor." : `No fue posible subir el archivo (error ${response.status}).`;
    throw new Error(String(json.error || fallback));
  }
  return json;
}

export async function uploadFile({ file, url, headers, fields, onProgress }: { file: File; url: string; headers: Record<string, string>; fields: Record<string, string>; onProgress?: (done: number, total: number) => void }): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo supera el máximo de 10 MB.");
  if (file.size === 0) throw new Error("El archivo está vacío.");
  const fileType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
  const count = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  if (count === 1) {
    const form = new FormData();
    form.set("file", fileType && fileType !== file.type ? new Blob([file], { type: fileType }) : file, file.name);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    onProgress?.(0, 1);
    const json = await postPart(url, headers, form);
    onProgress?.(1, 1);
    if (!json.key) throw new Error("El servidor no confirmó el archivo subido.");
    return json as UploadResult;
  }
  const id = uploadId();
  let last: Record<string, unknown> = {};
  for (let index = 0; index < count; index++) {
    const form = new FormData();
    form.set("file", new Blob([file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)], { type: "application/octet-stream" }), `${index}.part`);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.set("uploadId", id);
    form.set("chunkIndex", String(index));
    form.set("chunkCount", String(count));
    form.set("totalSize", String(file.size));
    form.set("fileName", file.name);
    form.set("fileType", fileType);
    onProgress?.(index, count);
    last = await postPart(url, headers, form);
  }
  onProgress?.(count, count);
  if (!last.key) throw new Error("El servidor no confirmó el archivo subido.");
  return last as UploadResult;
}
