import { useCallback, useState } from "react";
import type { PanelFilter, PanelWeekState } from "./types";
import { PANEL_SESSION_KEY } from "./types";

const EMPTY: PanelWeekState = {
  weekStart: null,
  filter: "all",
  selectedClientId: null,
};

function isFilter(value: unknown): value is PanelFilter {
  return value === "all" || value === "risk" || value === "missing";
}

export function readPanelWeek(): PanelWeekState {
  try {
    const raw = sessionStorage.getItem(PANEL_SESSION_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PanelWeekState>;
    return {
      weekStart: typeof parsed.weekStart === "string" ? parsed.weekStart : null,
      filter: isFilter(parsed.filter) ? parsed.filter : "all",
      selectedClientId:
        typeof parsed.selectedClientId === "number" ? parsed.selectedClientId : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writePanelWeek(next: PanelWeekState): void {
  try {
    sessionStorage.setItem(PANEL_SESSION_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function setPanelFilterIntent(filter: PanelFilter): void {
  const prev = readPanelWeek();
  writePanelWeek({ ...prev, filter, selectedClientId: null });
}

export function usePanelWeek() {
  const [state, setState] = useState<PanelWeekState>(() => readPanelWeek());

  const commit = useCallback((patch: Partial<PanelWeekState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writePanelWeek(next);
      return next;
    });
  }, []);

  const setWeekStart = useCallback(
    (weekStart: string) => commit({ weekStart }),
    [commit],
  );
  const setFilter = useCallback(
    (filter: PanelFilter) => commit({ filter }),
    [commit],
  );
  const setSelectedClientId = useCallback(
    (selectedClientId: number | null) => commit({ selectedClientId }),
    [commit],
  );

  return {
    weekStart: state.weekStart,
    filter: state.filter,
    selectedClientId: state.selectedClientId,
    setWeekStart,
    setFilter,
    setSelectedClientId,
  };
}
