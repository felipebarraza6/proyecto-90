import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getOrCreateViewer, requireRole } from "../../../db/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getChatGPTUser(); if (!auth) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const viewer = await getOrCreateViewer(auth); requireRole(viewer, ["admin", "professional"]);
  if (viewer.role === "professional" && !["nutrition","both"].includes(viewer.professionalType || "both")) return Response.json({ error: "No autorizado para planes nutricionales" }, { status: 403 });
  const form = await request.formData(); const file = form.get("file"); const userId = String(form.get("userId") ?? "");
  if (!(file instanceof File) || file.type !== "application/pdf") return Response.json({ error: "Selecciona un PDF válido" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "El PDF supera 10 MB" }, { status: 400 });
  const key = `nutrition/${userId}/${crypto.randomUUID()}.pdf`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: "application/pdf" }, customMetadata: { userId, uploadedBy: viewer.id, originalName: file.name } });
  return Response.json({ ok: true, key, name: file.name });
}

export async function GET(request: Request) {
  const auth = await getChatGPTUser(); if (!auth) return new Response("No autorizado", { status: 401 });
  const viewer = await getOrCreateViewer(auth); const key = new URL(request.url).searchParams.get("key"); if (!key) return new Response("Falta archivo", { status: 400 });
  if (viewer.role === "professional" && !["nutrition","both"].includes(viewer.professionalType || "both")) return new Response("No autorizado", { status: 403 });
  if (viewer.role === "participant") {
    const allowed = await env.DB.prepare("SELECT 1 FROM nutrition_plans WHERE user_id=? AND pdf_key=? AND review_status='approved' LIMIT 1").bind(viewer.id,key).first();
    if (!allowed) return new Response("No autorizado", { status: 403 });
  }
  const object = await env.FILES.get(key); if (!object) return new Response("Archivo no encontrado", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "application/pdf", "content-disposition": "inline" } });
}
