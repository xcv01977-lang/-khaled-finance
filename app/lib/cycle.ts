// Dates are plain "YYYY-MM-DD" strings handled in UTC so the device timezone never shifts a day.

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const ms = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

export function addDays(s: string, n: number): string {
  const d = new Date(ms(s) + n * 86_400_000);
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
export const diffDays = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000);
export const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Today in Saudi time as YYYY-MM-DD. */
export function todayRiyadh(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
}

/**
 * Payday for a month. The salary lands on cycleDay, but Friday pays on Thursday
 * and Saturday pays on Sunday (weekend_shift).
 */
export function paydayOf(y: number, m0: number, cycleDay: number, shift = true): string {
  const norm = new Date(Date.UTC(y, m0, 1));
  const yy = norm.getUTCFullYear();
  const mm = norm.getUTCMonth();
  let s = iso(yy, mm, Math.min(cycleDay, daysInMonth(yy, mm)));
  if (shift) {
    const wd = new Date(ms(s)).getUTCDay(); // 5 = Friday, 6 = Saturday
    if (wd === 5) s = addDays(s, -1);
    else if (wd === 6) s = addDays(s, 1);
  }
  return s;
}

export type Cycle = {
  start: string;
  end: string; // last day of the cycle (day before the next payday)
  next: string; // next payday
  length: number;
  day: number; // 1-based index of today inside the cycle
  daysLeft: number; // including today
};

export function cycleFor(today: string, cycleDay: number, shift = true): Cycle {
  const y = +today.slice(0, 4);
  const m0 = +today.slice(5, 7) - 1;
  const paydays = [-1, 0, 1].map((o) => paydayOf(y, m0 + o, cycleDay, shift)).sort();
  const start = [...paydays].reverse().find((p) => p <= today)!;
  const next = paydays.find((p) => p > today)!;
  return {
    start,
    end: addDays(next, -1),
    next,
    length: diffDays(start, next),
    day: diffDays(start, today) + 1,
    daysLeft: diffDays(today, next),
  };
}

/** The date inside [start, end] whose day-of-month is dueDay (clamped to month length), or null. */
export function dueDateInCycle(dueDay: number, start: string, end: string): string | null {
  const y = +start.slice(0, 4);
  const m0 = +start.slice(5, 7) - 1;
  for (const o of [0, 1]) {
    const norm = new Date(Date.UTC(y, m0 + o, 1));
    const yy = norm.getUTCFullYear();
    const mm = norm.getUTCMonth();
    const s = iso(yy, mm, Math.min(dueDay, daysInMonth(yy, mm)));
    if (s >= start && s <= end) return s;
  }
  return null;
}
