import { createContext, useContext, type ReactNode } from "react";
import { PANEL_CONFIG_DEFAULTS } from "./panelConfig";
import type { PanelConfig } from "./types";

type PanelStats = {
  percent_decimals: number;
  thresholds: PanelConfig["thresholds"];
  habit_weights: PanelConfig["habit_weights"];
};

const DEFAULTS: PanelStats = {
  percent_decimals: 1,
  thresholds: { green_gt: 80, yellow_gte: 70, risk: 70 },
  habit_weights: PANEL_CONFIG_DEFAULTS.habit_weights,
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePanelStats(): PanelStats {
  return useContext(Ctx);
}
