import { createContext, useContext, type ReactNode } from "react";
import { PANEL_CONFIG_DEFAULTS } from "./panelConfig";
import type { PanelConfig } from "./types";

type PanelStats = {
  percent_decimals: number;
  thresholds: PanelConfig["thresholds"];
  habit_weights: PanelConfig["habit_weights"];
  adherence_equal_weights_as_40_40_20: boolean;
  challenge_length_days: number;
  milestone_days: number[];
  milestone_windows: PanelConfig["milestone_windows"];
  weight_min_kg: number;
  weight_max_kg: number;
  height_min_cm: number;
  height_max_cm: number;
  missing_alert_min_days: number;
  report_grace_hours: number;
  alert_min_affected_days: number;
};

const DEFAULTS: PanelStats = {
  percent_decimals: PANEL_CONFIG_DEFAULTS.percent_decimals,
  thresholds: { ...PANEL_CONFIG_DEFAULTS.thresholds },
  habit_weights: PANEL_CONFIG_DEFAULTS.habit_weights,
  adherence_equal_weights_as_40_40_20: PANEL_CONFIG_DEFAULTS.adherence_equal_weights_as_40_40_20,
  challenge_length_days: PANEL_CONFIG_DEFAULTS.challenge_length_days,
  milestone_days: [...PANEL_CONFIG_DEFAULTS.milestone_days],
  milestone_windows: { ...PANEL_CONFIG_DEFAULTS.milestone_windows },
  weight_min_kg: PANEL_CONFIG_DEFAULTS.weight_min_kg,
  weight_max_kg: PANEL_CONFIG_DEFAULTS.weight_max_kg,
  height_min_cm: PANEL_CONFIG_DEFAULTS.height_min_cm,
  height_max_cm: PANEL_CONFIG_DEFAULTS.height_max_cm,
  missing_alert_min_days: PANEL_CONFIG_DEFAULTS.missing_alert_min_days,
  report_grace_hours: PANEL_CONFIG_DEFAULTS.report_grace_hours,
  alert_min_affected_days: PANEL_CONFIG_DEFAULTS.alert_min_affected_days,
};

const Ctx = createContext<PanelStats>(DEFAULTS);

export function PanelStatsProvider({
  config,
  children,
}: {
  config: PanelConfig;
  children: ReactNode;
}) {
  return (
    <Ctx.Provider
      value={{
        percent_decimals: config.percent_decimals,
        thresholds: config.thresholds,
        habit_weights: config.habit_weights,
        adherence_equal_weights_as_40_40_20: config.adherence_equal_weights_as_40_40_20,
        challenge_length_days: config.challenge_length_days,
        milestone_days: config.milestone_days,
        milestone_windows: config.milestone_windows,
        weight_min_kg: config.weight_min_kg,
        weight_max_kg: config.weight_max_kg,
        height_min_cm: config.height_min_cm,
        height_max_cm: config.height_max_cm,
        missing_alert_min_days: config.missing_alert_min_days,
        report_grace_hours: config.report_grace_hours,
        alert_min_affected_days: config.alert_min_affected_days,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePanelStats(): PanelStats {
  return useContext(Ctx);
}
