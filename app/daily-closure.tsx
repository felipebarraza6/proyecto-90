"use client";

import { useMemo, useState } from "react";
import { chileToday, type Row } from "./adherence-alerts";
import { macrosDayStatus, PANEL_CONFIG_DEFAULTS } from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

type ClosureHabit = "training" | "macros";
type CellState = "met" | "missed" | "unlogged";

const nameOf = (row: Row) =>
  `${row.first_name || ""} ${row.last_name || ""}`.trim() || String(row.email || "Alumno");
const cellCopy: Record<CellState, string> = {
  met: "✓ Reportado",
  missed: "✗ No cumplió",
  unlogged: "— Sin registrar",
};

function formatChile(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

export function DailyClosure({
  people,
  records,
  nutritionRecords,
  habits,
  panelConfig,
}: {
  people: Row[];
  records: Row[];
  nutritionRecords: Row[];
  habits: ClosureHabit[];
  panelConfig?: PanelConfig | null;
}) {
  const [date, setDate] = useState(chileToday());
  const [onlyMissing, setOnlyMissing] = useState(true);

  const rows = useMemo(() => {
    const macroCfg = {
      macro_met_requires: panelConfig?.macro_met_requires || PANEL_CONFIG_DEFAULTS.macro_met_requires,
      macro_ranges: panelConfig?.macro_ranges || PANEL_CONFIG_DEFAULTS.macro_ranges,
      calories_min_enabled:
        panelConfig?.calories_min_enabled ?? PANEL_CONFIG_DEFAULTS.calories_min_enabled,
      calories_low_ratio: panelConfig?.calories_low_ratio ?? PANEL_CONFIG_DEFAULTS.calories_low_ratio,
    };
    const habitLookup = new Map(
      records.map((row) => [`${row.user_id}:${row.habit}:${row.habit_date}`, String(row.status)]),
    );
    return people
      .map((person) => {
        const id = String(person.id);
        const start = String(
          person.challenge_start || person.assigned_at || person.created_at || "",
        ).slice(0, 10);
        if (!start || date < start) return null;
        const day =
          Math.floor(
            (new Date(`${date}T12:00:00Z`).getTime() -
              new Date(`${start}T12:00:00Z`).getTime()) /
              86400000,
          ) + 1;
        if (day > 90) return null;
        const cells: Partial<Record<ClosureHabit, CellState>> = {};
        for (const habit of habits) {
          if (habit === "training") {
            cells.training =
              (habitLookup.get(`${id}:training:${date}`) as CellState) || "unlogged";
          } else {
            const row =
              nutritionRecords.find(
                (item) => String(item.user_id) === id && String(item.log_date) === date,
              ) || null;
            if (!row) cells.macros = "unlogged";
            else {
              const status = macrosDayStatus(
                {
                  calories: Number(row.calories || 0),
                  protein: Number(row.protein || 0),
                  carbs: Number(row.carbs || 0),
                  fats: Number(row.fats || 0),
                },
                {
                  calories: Number(person.calories || 0),
                  protein: Number(person.protein || 0),
                  carbs: Number(person.carbs || 0),
                  fats: Number(person.fats || 0),
                },
                macroCfg,
              );
              cells.macros = status === "empty" ? "unlogged" : status;
            }
          }
        }
        const missing = habits.filter((habit) => cells[habit] === "unlogged");
        return {
          person,
          cells,
          missing,
          missingLabels: missing.map((habit) => (habit === "training" ? "entreno" : "macros")),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => !onlyMissing || row.missing.length > 0);
  }, [people, records, nutritionRecords, habits, date, onlyMissing, panelConfig]);

  const missingCount = rows.filter((row) => row.missing.length > 0).length;

  function summary() {
    const lines = [`Cierre del día · ${formatChile(date)}`];
    const pending = rows.filter((row) => row.missing.length > 0);
    if (pending.length === 0)
      lines.push("Todos los alumnos activos tienen sus actividades del día registradas.");
    else {
      lines.push(`Sin registrar (${pending.length}):`);
      for (const row of pending)
        lines.push(`• ${nameOf(row.person)} — falta ${row.missingLabels.join(" y ")}`);
    }
    return lines.join("\n");
  }
  const [copied, setCopied] = useState(false);
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary());
    } catch {
      /* sin permiso de portapapeles */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="daily-closure">
      <header className="daily-closure-head">
        <div>
          <span className="eyebrow">CIERRE DEL DÍA</span>
          <h2>Registro de actividades cargadas</h2>
          <p>
            Quiénes tienen su día registrado y quiénes no, al cierre de la fecha elegida. El
            cumplimiento de macros usa las reglas configuradas del panel.
          </p>
        </div>
        <div className="daily-closure-controls">
          <input
            type="date"
            max={chileToday()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Fecha del cierre"
          />
          <label className="daily-closure-toggle">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            Solo sin registrar
          </label>
          <button className="secondary" onClick={copySummary}>
            {copied ? "✓ Resumen copiado" : "Copiar resumen"}
          </button>
        </div>
      </header>
      <div className="daily-closure-summary">
        <span>
          <b>{rows.length}</b>
          <small>alumnos en el día {formatChile(date)}</small>
        </span>
        <span>
          <b>{missingCount}</b>
          <small>sin registrar</small>
        </span>
        <span>
          <b>{rows.length - missingCount}</b>
          <small>al día</small>
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="professional-file-empty">
          <b>Nada para esta fecha</b>
          <p>No hay alumnos con el desafío activo en el día seleccionado.</p>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Día</th>
                {habits.includes("training") && <th>Entrenamiento</th>}
                {habits.includes("macros") && <th>Macros</th>}
                <th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={String(row.person.id)}
                  className={row.missing.length ? "closure-missing" : ""}
                >
                  <td>
                    <b>{nameOf(row.person)}</b>
                  </td>
                  <td>
                    {Math.max(
                      1,
                      Math.min(
                        90,
                        Math.floor(
                          (new Date(`${date}T12:00:00Z`).getTime() -
                            new Date(
                              `${String(row.person.challenge_start || row.person.assigned_at || "").slice(0, 10)}T12:00:00Z`,
                            ).getTime()) /
                            86400000,
                        ) + 1,
                      ),
                    )}
                    /90
                  </td>
                  {habits.includes("training") && (
                    <td>
                      <span className={`closure-cell ${row.cells.training || "unlogged"}`}>
                        {cellCopy[row.cells.training || "unlogged"]}
                      </span>
                    </td>
                  )}
                  {habits.includes("macros") && (
                    <td>
                      <span className={`closure-cell ${row.cells.macros || "unlogged"}`}>
                        {cellCopy[row.cells.macros || "unlogged"]}
                      </span>
                    </td>
                  )}
                  <td>{row.missing.length ? row.missingLabels.join(" y ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="daily-closure-note">
        «Sin registrar» = el alumno no cargó ese hábito en la fecha elegida. El registro usa la
        fecha de Chile y el reloj de 90 días de cada alumno.
      </p>
    </section>
  );
}
