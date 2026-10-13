import { PANEL_SCREEN } from "./types";

export { PANEL_SCREEN };

export function normalizeScreen(name: string): string {
  if (name === "Adherencia" || name === "Seguimiento") return PANEL_SCREEN;
  if (name === "Comentarios") return "Mensajes";
  return name;
}

export function navShortLabel(name: string): string {
  if (name === PANEL_SCREEN) return "Adherencia";
  if (name === "Mensajes" || name === "Comentarios") return "Mensajes";
  if (name.includes("/")) return name.split("/")[0];
  return name;
}

// La config cargada alcanza. El booleano panel_enabled no decide si el panel se ve.
export function staffPanelActive(config: object | null): boolean {
  return config != null;
}
