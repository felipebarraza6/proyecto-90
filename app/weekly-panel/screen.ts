import { PANEL_SCREEN } from "./types";

export { PANEL_SCREEN };

export function normalizeScreen(name: string): string {
  if (name === "Adherencia" || name === "Seguimiento") return PANEL_SCREEN;
  return name;
}

export function navShortLabel(name: string): string {
  if (name === PANEL_SCREEN) return "Adherencia";
  if (name.includes("/")) return name.split("/")[0];
  return name;
}
