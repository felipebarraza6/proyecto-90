import type { paths } from "../../src/lib/api/types/yggdra";

/** Paths del contrato (yggdra_infra #393). El OpenAPI no declara cuerpo de respuesta. */
export type StudentMeWeeksQuery = NonNullable<
  paths["/api/p90/panel/me/weeks"]["get"]["parameters"]["query"]
>;
export type StudentMeWeekQuery = NonNullable<
  paths["/api/p90/panel/me/week"]["get"]["parameters"]["query"]
>;

export const STUDENT_SELF_WEEKS_PATH = "/api/p90/panel/me/weeks" satisfies keyof paths;
export const STUDENT_SELF_WEEK_PATH = "/api/p90/panel/me/week" satisfies keyof paths;

/** Rutas relativas al prefijo /api/p90/panel que usa panelFetch. */
export function myWeeksPanelPath(): "/me/weeks" {
  return "/me/weeks";
}

export function myWeekPanelPath(week: string): string {
  const query: StudentMeWeekQuery = { week };
  const params = new URLSearchParams();
  if (query.week) params.set("week", query.week);
  return `/me/week?${params.toString()}`;
}

export function studentSelfRequestUrls(week: string): string[] {
  return [STUDENT_SELF_WEEKS_PATH, `${STUDENT_SELF_WEEK_PATH}?week=${encodeURIComponent(week)}`];
}

const STAFF_EXACT = new Set(["/api/p90/panel/weeks", "/api/p90/panel/week"]);

/** true si la URL es de staff (listado, ficha ajena, análisis o comentarios). /me/* no cuenta. */
export function isStaffPanelRequest(url: string): boolean {
  const path = url.split("?")[0].replace(/\/$/, "");
  if (path === STUDENT_SELF_WEEKS_PATH || path === STUDENT_SELF_WEEK_PATH) return false;
  if (STAFF_EXACT.has(path)) return true;
  return (
    path.includes("/participants/") ||
    path.endsWith("/analysis") ||
    path.includes("/comments")
  );
}

/** API vieja o panel desactivado: ocultar la ficha sin error visible. */
export function studentSelfUnavailable(status: number): boolean {
  return status === 403 || status === 404;
}
