export type ClosureDay = {
  date: string;
  pct: number | null;
  closed: boolean;
};

function utcDay(iso: string): number {
  return Date.parse(`${iso}T12:00:00Z`);
}

function isoFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function eachDate(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  for (let cursor = utcDay(from); cursor <= utcDay(to); cursor += 86400000) {
    out.push(isoFromUtc(cursor));
  }
  return out;
}

/** Un cierre cuenta solo si hay registro y el % es estrictamente mayor a 80. */
export function closureCounts(day: ClosureDay | undefined): boolean {
  if (!day?.closed || day.pct == null || !Number.isFinite(day.pct)) return false;
  return day.pct > 80;
}

export function adherenceStreaks(
  days: ClosureDay[],
  today: string,
): { current: number; best: number } {
  const byDate = new Map(days.filter((day) => day.date <= today).map((day) => [day.date, day]));
  const known = [...byDate.keys()].sort();
  if (!known.length) return { current: 0, best: 0 };
  let best = 0;
  let run = 0;
  for (const date of eachDate(known[0], today)) {
    if (closureCounts(byDate.get(date))) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return { current: run, best };
}

export function monthAdherenceSummary(
  days: ClosureDay[],
  month: string,
  today: string,
): { closedDays: number; above80: number; averagePct: number | null } {
  const inMonth = days.filter(
    (day) => day.date.startsWith(month) && day.date <= today && day.closed && day.pct != null && Number.isFinite(day.pct),
  );
  if (!inMonth.length) return { closedDays: 0, above80: 0, averagePct: null };
  const sum = inMonth.reduce((total, day) => total + Number(day.pct), 0);
  return {
    closedDays: inMonth.length,
    above80: inMonth.filter((day) => Number(day.pct) > 80).length,
    averagePct: sum / inMonth.length,
  };
}
