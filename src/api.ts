// Base de la API. En desarrollo el proxy de vite resuelve /api;
// en producción se define VITE_API_BASE (ej: https://api.yggdra.cl).
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${localStorage.getItem("p90_token") || ""}`,
    "X-Branch-ID": localStorage.getItem("p90_branch") || "",
  };
}
