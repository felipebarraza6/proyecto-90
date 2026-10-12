import {
  chooseWeekAdherence,
  type WeekAdherenceChoice,
} from "./panel-week-adherence";
import { formatPct } from "./weekly-panel/format";
import { PANEL_CONFIG_DEFAULTS } from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

export type AdherenceDisplay = {
  text: string;
  label: string;
  isWeeklyPanel: boolean;
};

export type PanelWeekPctOverride = {
  pct: number | null;
  weekLabel: string;
};

const FALLBACK_PCT_DECIMALS = 1;

export function participantAdherenceDisplay(
  person: Record<string, unknown>,
  panelConfig?: PanelConfig | null,
  panelWeek?: PanelWeekPctOverride | null,
): AdherenceDisplay {
  const decimals =
    panelConfig?.percent_decimals ??
    PANEL_CONFIG_DEFAULTS.percent_decimals ??
    FALLBACK_PCT_DECIMALS;
  const choice: WeekAdherenceChoice = chooseWeekAdherence(
    panelWeek ?? null,
    person.adherence,
  );
  return {
    text: formatPct(choice.pct, decimals),
    label: choice.label,
    isWeeklyPanel: choice.isWeeklyPanel,
  };
}

export { panelConfigCanEdit } from "./panel-week-adherence";
