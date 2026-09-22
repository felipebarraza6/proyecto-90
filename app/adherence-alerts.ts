export type Row = Record<string, unknown>;
export type AlertHabit = "training" | "macros";

const alertLabels: Record<AlertHabit, string> = {
  training: "Entrenamiento",
  macros: "Macros",
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
export const chileToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const mondayOf = (date: Date) => {
  const copy = new Date(`${iso(date)}T12:00:00Z`);
  const day = copy.getUTCDay();
  return addDays(copy, -(day === 0 ? 6 : day - 1));
};

const personStart = (row: Row) =>
  String(row.challenge_start || row.assigned_at || row.created_at || "").slice(0, 10);

function hasThreeConsecutiveMisses(
  lookup: Map<string, string>,
  userId: string,
  habit: AlertHabit,
  days: Date[],
  start: string,
) {
  let streak = 0;
  for (const day of days) {
    const date = iso(day);
    if (start && date < start) continue;
    streak = lookup.get(`${userId}:${habit}:${date}`) === "missed" ? streak + 1 : 0;
    if (streak >= 3) return true;
  }
  return false;
}

export function buildEffectiveRecords(
  people: Row[],
  records: Row[],
  nutritionRecords: Row[],
) {
  const calculated = nutritionRecords.flatMap((row) => {
    const person = people.find((item) => String(item.id) === String(row.user_id));
    const calories = Number(row.calories || 0);
    const protein = Number(row.protein || 0);
    const targetCalories = Number(person?.calories || 0);
    const targetProtein = Number(person?.protein || 0);
    if (!targetCalories || !targetProtein) return [];
    return [
      {
        user_id: row.user_id,
        habit: "macros",
        habit_date: row.log_date,
        status:
          calories > targetCalories * 1.1 || protein < targetProtein * 0.9
            ? "missed"
            : "met",
      },
    ];
  });
  return [...records.filter((row) => row.habit !== "macros"), ...calculated];
}

export function computeAdherenceAlerts(
  people: Row[],
  records: Row[],
  nutritionRecords: Row[],
  habits: AlertHabit[] = ["training", "macros"],
) {
  const today = chileToday();
  const currentMonday = mondayOf(new Date(`${today}T12:00:00Z`));
  const days = Array.from({ length: 7 }, (_, index) => addDays(currentMonday, index));
  const closedDays = days.filter((day) => iso(day) < today);
  const cutoff = iso(addDays(new Date(`${today}T12:00:00Z`), -2));
  const overdueDays = days.filter((day) => iso(day) <= cutoff);
  const effective = buildEffectiveRecords(people, records, nutritionRecords);
  const lookup = new Map(
    effective.map((row) => [`${row.user_id}:${row.habit}:${row.habit_date}`, String(row.status)]),
  );

  const riskReasons = new Map(
    people
      .map((person) => {
        const id = String(person.id);
        const start = personStart(person);
        const reasons = habits
          .filter((key) => hasThreeConsecutiveMisses(lookup, id, key, closedDays, start))
          .map((key) => alertLabels[key]);
        return [id, reasons] as const;
      })
      .filter(([, reasons]) => reasons.length),
  );

  const missingReasons = new Map(
    people
      .map((person) => {
        const id = String(person.id);
        const start = personStart(person);
        const eligible = overdueDays.filter((day) => !start || iso(day) >= start);
        const reasons = habits
          .filter((key) => eligible.some((day) => !lookup.has(`${id}:${key}:${iso(day)}`)))
          .map((key) => alertLabels[key]);
        return [id, reasons] as const;
      })
      .filter(([, reasons]) => reasons.length),
  );

  return {
    today,
    currentMonday,
    riskReasons,
    missingReasons,
    riskCount: riskReasons.size,
    missingCount: missingReasons.size,
    total: riskReasons.size + missingReasons.size,
  };
}
