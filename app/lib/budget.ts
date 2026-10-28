import { cycleFor, diffDays, dueDateInCycle, type Cycle } from "./cycle";
import { fmt } from "./money";
import type { Commitment, Payment, Settings, Tx } from "./types";

export type UpcomingStatus = "paid" | "overdue" | "today" | "soon";

export type Upcoming = {
  commitment: Commitment;
  due: string;
  status: UpcomingStatus;
  inDays: number;
  payment?: Payment;
};

export type Alert = { id: string; tone: "bad" | "warn"; text: string };

export type Summary = {
  cycle: Cycle;
  pool: number; // what the spending budget is made of, halalas
  spent: number;
  spentToday: number;
  dailyBudget: number; // reference daily allowance
  allowedToday: number; // can be negative
  projectedSurplus: number;
  commitmentsTotal: number;
  commitmentsLeft: number;
  upcoming: Upcoming[];
  alerts: Alert[];
};

type Input = {
  today: string;
  settings: Settings;
  txs: Tx[];
  commitments: Commitment[];
  payments: Payment[];
};

const net = (t: Tx) => (t.kind === "refund" ? -t.amount_halalas : t.amount_halalas);

export function summarize({ today, settings, txs, commitments, payments }: Input): Summary {
  const cycle = cycleFor(today, settings.cycle_day, settings.weekend_shift);

  const upcoming: Upcoming[] = [];
  for (const c of commitments) {
    if (!c.active) continue;
    const due = dueDateInCycle(c.due_day, cycle.start, cycle.end);
    if (!due) continue;
    const payment = payments.find((p) => p.commitment_id === c.id && p.cycle_start === cycle.start);
    const inDays = diffDays(today, due);
    const status: UpcomingStatus = payment
      ? "paid"
      : inDays < 0
        ? "overdue"
        : inDays === 0
          ? "today"
          : "soon";
    upcoming.push({ commitment: c, due, status, inDays, payment });
  }
  upcoming.sort((a, b) => a.due.localeCompare(b.due));

  const commitmentsTotal = upcoming.reduce((s, u) => s + u.commitment.amount_halalas, 0);
  const commitmentsLeft = upcoming
    .filter((u) => u.status !== "paid")
    .reduce((s, u) => s + u.commitment.amount_halalas, 0);

  // Fixed commitments come off the salary first; whatever is left is the spending pool
  // unless the user set a spending budget explicitly.
  const pool =
    settings.spending_budget_halalas ?? Math.max(0, settings.salary_halalas - commitmentsTotal);

  const inCycle = txs.filter((t) => t.occurred_on >= cycle.start && t.occurred_on <= cycle.end);
  const spent = inCycle.reduce((s, t) => s + net(t), 0);
  const spentToday = inCycle.filter((t) => t.occurred_on === today).reduce((s, t) => s + net(t), 0);
  const spentBefore = spent - spentToday;

  const dailyBudget =
    settings.daily_allowance_halalas ?? Math.floor(pool / cycle.length / 100) * 100;

  // Adaptive: what is left at the start of today spread over the days that remain.
  const perDay = cycle.daysLeft > 0 ? Math.round((pool - spentBefore) / cycle.daysLeft) : 0;
  const allowedToday = perDay - spentToday;

  // Projection: current pace (or the planned daily budget during the first days).
  const pace = cycle.day >= 3 ? spent / cycle.day : dailyBudget;
  const projectedSurplus = Math.round(pool - (spent + pace * (cycle.daysLeft - 1)));

  const alerts: Alert[] = [];
  const overdue = upcoming.filter((u) => u.status === "overdue");
  if (overdue.length) {
    alerts.push({
      id: "overdue",
      tone: "bad",
      text:
        overdue.length === 1
          ? `دفعة متأخرة: ${overdue[0].commitment.emoji} ${overdue[0].commitment.name}`
          : `${overdue.length} دفعات متأخرة`,
    });
  }
  if (pool > 0 && allowedToday < 0) {
    alerts.push({ id: "over-today", tone: "warn", text: `تعديت مخصص اليوم بـ ${fmt(-allowedToday)} ر.س` });
  }

  return {
    cycle, pool, spent, spentToday, dailyBudget, allowedToday, projectedSurplus,
    commitmentsTotal, commitmentsLeft, upcoming, alerts,
  };
}

