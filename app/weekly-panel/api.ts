import { apiUrl, authHeaders } from "../../src/api";
import { normalizePanelConfig } from "./panelConfig";
import type {
  AnalysisResponse,
  CommentItem,
  CommentsResponse,
  HabitPlanResponse,
  HabitPlanSaveBody,
  HabitPlanSaveResponse,
  PanelConfig,
  PanelConfigPatch,
  PanelFilter,
  StudentWeekResponse,
  WeekResponse,
  WeeksResponse,
} from "./types";

const PREFIX = "/api/p90/panel";

export class PanelApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = "PanelApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.error === "string" && rec.error) return rec.error;
    if (typeof rec.detail === "string" && rec.detail) return rec.detail;
  }
  return fallback;
}

async function panelFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(apiUrl(`${PREFIX}${path}`), {
    ...init,
    headers,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = await parseBody(res);
  if (!res.ok) {
    throw new PanelApiError(
      res.status,
      errorMessage(body, `Error ${res.status}`),
      body,
    );
  }
  return body as T;
}

export async function fetchPanelConfig(signal?: AbortSignal): Promise<PanelConfig> {
  const raw = await panelFetch<Partial<PanelConfig>>("/config", { signal });
  return normalizePanelConfig(raw);
}

/** True si el backend admite PATCH (Allow incluye PATCH). Prod viejo → false. */
export async function probePanelConfigWritable(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`${PREFIX}/config`), {
      method: "OPTIONS",
      headers: authHeaders(),
      signal,
      cache: "no-store",
    });
    const allow = `${res.headers.get("allow") || ""} ${res.headers.get("Access-Control-Allow-Methods") || ""}`.toUpperCase();
    if (allow.includes("PATCH")) return true;
    // Allow explícito sin PATCH → solo lectura (caso producción actual).
    if (/\bGET\b/.test(allow) && !allow.includes("PATCH")) return false;
    // Allow vacío/no confiable: sondear con campo inválido (400 ≠ mutación).
    const probe = await fetch(apiUrl(`${PREFIX}/config`), {
      method: "PATCH",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ __writable_probe__: true }),
      signal,
      cache: "no-store",
    });
    if (probe.status === 405 || probe.status === 404) return false;
    return true;
  } catch {
    return false;
  }
}

export async function patchPanelConfig(
  body: PanelConfigPatch,
  signal?: AbortSignal,
): Promise<PanelConfig> {
  const raw = await panelFetch<Partial<PanelConfig>>("/config", {
    method: "PATCH",
    body: JSON.stringify(body),
    signal,
  });
  return normalizePanelConfig(raw);
}

export function fetchWeeks(signal?: AbortSignal): Promise<WeeksResponse> {
  return panelFetch<WeeksResponse>("/weeks", { signal });
}

export function fetchWeek(
  weekStart: string,
  filter: PanelFilter,
  signal?: AbortSignal,
): Promise<WeekResponse> {
  const params = new URLSearchParams({
    week_start: weekStart,
    filter,
  });
  return panelFetch<WeekResponse>(`/week?${params}`, { signal });
}

export function fetchStudentWeek(
  clientId: number,
  weekStart: string,
  signal?: AbortSignal,
): Promise<StudentWeekResponse> {
  const params = new URLSearchParams({ week_start: weekStart });
  return panelFetch<StudentWeekResponse>(
    `/participants/${clientId}/week?${params}`,
    { signal },
  );
}

export async function fetchAnalysis(
  clientId: number,
  weekStart: string,
  refresh = false,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const params = new URLSearchParams({
    week_start: weekStart,
    refresh: refresh ? "1" : "0",
  });
  try {
    return await panelFetch<AnalysisResponse>(
      `/participants/${clientId}/analysis?${params}`,
      { signal },
    );
  } catch (err) {
    if (err instanceof PanelApiError && err.status === 503) {
      const payload = (err.payload || {}) as AnalysisResponse;
      return {
        status: "error",
        engine: payload.engine,
        data_version: payload.data_version,
        coverage: payload.coverage,
        alerts: payload.alerts || [],
        summary_text: payload.summary_text,
        disclaimer: payload.disclaimer,
        generated_at: payload.generated_at,
        last_ok_generated_at: payload.last_ok_generated_at,
        error_message: payload.error_message || err.message,
      };
    }
    throw err;
  }
}

export function fetchComments(
  clientId: number,
  opts: { limit?: number; before?: string | null } = {},
  signal?: AbortSignal,
): Promise<CommentsResponse> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const q = params.toString();
  return panelFetch<CommentsResponse>(
    `/participants/${clientId}/comments${q ? `?${q}` : ""}`,
    { signal },
  );
}

export function postComment(
  clientId: number,
  body: { text: string; week_start: string; client_request_id: string },
  signal?: AbortSignal,
): Promise<{ item: CommentItem; duplicate?: boolean }> {
  return panelFetch(`/participants/${clientId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export function deleteComment(commentId: number, signal?: AbortSignal): Promise<void> {
  return panelFetch(`/comments/${commentId}`, { method: "DELETE", signal });
}

export function fetchHabitPlan(
  clientId: number,
  signal?: AbortSignal,
): Promise<HabitPlanResponse> {
  return panelFetch<HabitPlanResponse>(`/participants/${clientId}/habit-plan`, { signal });
}

export function saveHabitPlan(
  clientId: number,
  body: HabitPlanSaveBody,
  signal?: AbortSignal,
): Promise<HabitPlanSaveResponse> {
  return panelFetch<HabitPlanSaveResponse>(`/participants/${clientId}/habit-plan`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}
