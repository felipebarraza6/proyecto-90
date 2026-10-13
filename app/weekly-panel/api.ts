import { apiUrl, authHeaders } from "../../src/api";
import {
  MESSAGES_STREAM_TOKEN_PATH,
  buildStreamUrl,
  type StreamTokenResponse,
} from "./messageStream";
import { normalizePanelConfig } from "./panelConfig";
import type {
  AnalysisResponse,
  CommentItem,
  CommentsResponse,
  HabitPlanResponse,
  HabitPlanSaveBody,
  HabitPlanSaveResponse,
  MacroTargetRecord,
  MacroTargetSaveBody,
  MacroTargetsResponse,
  PanelConfig,
  PanelConfigPatch,
  PanelFilter,
  PanelMessage,
  PanelMessagesResponse,
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

function normalizeMessageList(raw: PanelMessagesResponse | PanelMessage[] | null | undefined): PanelMessage[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.messages)) return raw.messages;
  return [];
}

function normalizeMacroTargetList(
  raw: MacroTargetsResponse | MacroTargetRecord[] | null | undefined,
): { items: MacroTargetRecord[]; can_edit: boolean } {
  if (Array.isArray(raw)) return { items: raw, can_edit: true };
  if (!raw || typeof raw !== "object") return { items: [], can_edit: true };
  const items = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.targets)
      ? raw.targets
      : [];
  return { items, can_edit: raw.can_edit !== false };
}

export async function fetchMacroTargets(
  clientId: number,
  signal?: AbortSignal,
): Promise<{ items: MacroTargetRecord[]; can_edit: boolean }> {
  const raw = await panelFetch<MacroTargetsResponse | MacroTargetRecord[]>(
    `/participants/${clientId}/macro-targets`,
    { signal },
  );
  return normalizeMacroTargetList(raw);
}

export function saveMacroTarget(
  clientId: number,
  body: MacroTargetSaveBody,
  signal?: AbortSignal,
): Promise<MacroTargetRecord | { item: MacroTargetRecord }> {
  return panelFetch(`/participants/${clientId}/macro-targets`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export async function fetchParticipantMessages(
  clientId: number,
  signal?: AbortSignal,
): Promise<PanelMessage[]> {
  const raw = await panelFetch<PanelMessagesResponse | PanelMessage[]>(
    `/participants/${clientId}/messages`,
    { signal },
  );
  return normalizeMessageList(raw);
}

export function postParticipantMessage(
  clientId: number,
  body: { body: string; reply_to_all?: boolean },
  signal?: AbortSignal,
): Promise<PanelMessage | { item: PanelMessage }> {
  return panelFetch(`/participants/${clientId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export async function fetchMyMessages(signal?: AbortSignal): Promise<PanelMessage[]> {
  const raw = await panelFetch<PanelMessagesResponse | PanelMessage[]>(`/messages/me`, {
    signal,
  });
  return normalizeMessageList(raw);
}

export function postMyMessage(
  body: { body: string; recipient_role: "nutrition" | "admin" },
  signal?: AbortSignal,
): Promise<PanelMessage | { item: PanelMessage }> {
  return panelFetch(`/messages/me`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export function postBroadcastMessage(
  body: { body: string },
  signal?: AbortSignal,
): Promise<PanelMessage | { item: PanelMessage } | { ok?: boolean }> {
  return panelFetch(`/messages/broadcast`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * POST …/messages/stream-token (auth + X-Branch-ID).
 * Respuesta: { stream_token, expires_in: 120, stream_path }.
 * Si falla (404/etc.) retorna null → UI cae a poll.
 */
export async function fetchMessageStreamToken(
  signal?: AbortSignal,
): Promise<{ streamToken: string; url: string; expiresIn: number } | null> {
  try {
    const res = await fetch(apiUrl(MESSAGES_STREAM_TOKEN_PATH), {
      method: "POST",
      headers: {
        ...authHeaders(),
        "content-type": "application/json",
      },
      body: "{}",
      signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as StreamTokenResponse;
    const streamToken = String(json.stream_token || "").trim();
    if (!streamToken) return null;
    const streamPath = String(json.stream_path || "").trim();
    const url = streamPath
      ? streamPath.startsWith("http://") || streamPath.startsWith("https://")
        ? streamPath
        : apiUrl(streamPath)
      : apiUrl(buildStreamUrl(streamToken));
    const expiresIn = Number(json.expires_in);
    return {
      streamToken,
      url,
      expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 120,
    };
  } catch {
    return null;
  }
}
