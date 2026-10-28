import { lineIdOf, plannedFor } from "./balance";
import { cycleFor, diffDays, dueDateInCycle, type Cycle } from "./cycle";
import { fmt } from "./money";
import { scheduleOf } from "./installments";
import type { Category, Commitment, InstallmentPayment, InstallmentPlan, Line, Payment, Settings, Tx } from "./types";

export type UpcomingStatus = "paid" | "overdue" | "today" | "soon";

/** One thing to pay: a fixed commitment of this cycle, or one payment of a Tabby/Tamara-style plan. */
export type Upcoming = {
  key: string;
  kind: "commitment" | "installment";
  name: string;
  emoji: string;
  /** "دفعة 2 من 4" for plan payments. */
  detail?: string;
  amount_halalas: number;
  due: string;
  status: UpcomingStatus;
  inDays: number;
  commitment?: Commitment;
  payment?: Payment;
  plan?: InstallmentPlan;
  number?: number;
  installmentPayment?: InstallmentPayment;
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
  lines?: Line[];
  categories?: Category[];
  plans?: InstallmentPlan[];
  planPayments?: InstallmentPayment[];
};

const net = (t: Tx) => (t.kind === "refund" ? -t.amount_halalas : t.amount_halalas);

export function summarize({
  today, settings, txs, commitments, payments, lines = [], categories = [], plans = [], planPayments = [],
}: Input): Summary {
  const cycle = cycleFor(today, settings.cycle_day, settings.weekend_shift);

  const statusOf = (paid: boolean, inDays: number): UpcomingStatus =>
    paid ? "paid" : inDays < 0 ? "overdue" : inDays === 0 ? "today" : "soon";

  const upcoming: Upcoming[] = [];
  for (const c of commitments) {
    if (!c.active) continue;
    const due = dueDateInCycle(c.due_day, cycle.start, cycle.end);
    if (!due) continue;
    const payment = payments.find((p) => p.commitment_id === c.id && p.cycle_start === cycle.start);
    const inDays = diffDays(today, due);
    upcoming.push({
      key: `c:${c.id}`, kind: "commitment", name: c.name, emoji: c.emoji, amount_halalas: c.amount_halalas,
      due, status: statusOf(Boolean(payment), inDays), inDays, commitment: c, payment,
    });
  }
  // Plan payments due in this cycle, plus any earlier payment still unpaid.
  for (const plan of plans) {
    if (!plan.active) continue;
    for (const it of scheduleOf(plan, planPayments)) {
      const inCycle = it.due >= cycle.start && it.due <= cycle.end;
      if (!inCycle && !(!it.paid && it.due < cycle.start)) continue;
      const inDays = diffDays(today, it.due);
      upcoming.push({
        key: `i:${plan.id}:${it.number}`, kind: "installment", name: plan.name, emoji: "🧾",
        detail: `دفعة ${it.number} من ${plan.total_count}`, amount_halalas: plan.installment_halalas,
        due: it.due, status: statusOf(it.paid, inDays), inDays, plan, number: it.number, installmentPayment: it.payment,
      });
    }
  }
  upcoming.sort((a, b) => a.due.localeCompare(b.due));

  const commitmentsTotal = upcoming.reduce((s, u) => s + u.amount_halalas, 0);
  const commitmentsLeft = upcoming.filter((u) => u.status !== "paid").reduce((s, u) => s + u.amount_halalas, 0);

  // With budget lines, the pool is the planned amount of the lines that draw down the daily number,
  // and only spending routed to those lines counts. Without lines, fall back to the salary-based pool.
  const dailyLines = lines.filter((l) => l.active && l.counts_daily);
  const useLines = dailyLines.length > 0;
  const pool = useLines
    ? dailyLines.reduce((sum, l) => sum + plannedFor(l, cycle.start), 0)
    : (settings.spending_budget_halalas ?? Math.max(0, settings.salary_halalas - commitmentsTotal));

  const dailyIds = new Set(dailyLines.map((l) => l.id));
  const inCycle = txs.filter(
    (t) =>
      t.occurred_on >= cycle.start &&
      t.occurred_on <= cycle.end &&
      (!useLines || dailyIds.has(lineIdOf(t, categories, lines) ?? "")),
  );
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
          ? `دفعة متأخرة: ${overdue[0].emoji} ${overdue[0].name}${overdue[0].detail ? ` (${overdue[0].detail})` : ""}`
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

