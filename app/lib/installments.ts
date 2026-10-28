import { addDays, daysInMonth, iso } from "./cycle";
import type { InstallmentPayment, InstallmentPlan } from "./types";

/** `date` moved forward by `n` months, keeping the original day of month where the month is long enough. */
export function addMonths(date: string, n: number, anchorDay = +date.slice(8, 10)): string {
  const base = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1 + n, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  return iso(y, m, Math.min(anchorDay, daysInMonth(y, m)));
}

/** Due date of payment number `k` (0-based). */
export function dueDateOf(plan: Pick<InstallmentPlan, "first_due" | "period">, k: number): string {
  if (plan.period === "monthly") return addMonths(plan.first_due, k);
  return addDays(plan.first_due, k * (plan.period === "weekly" ? 7 : 14));
}

export type Installment = { number: number; due: string; paid: boolean; payment?: InstallmentPayment };

/** All payments of a plan with their due date and whether each one was paid. `number` is 1-based. */
export function scheduleOf(plan: InstallmentPlan, payments: InstallmentPayment[]): Installment[] {
  return Array.from({ length: plan.total_count }, (_, i) => {
    const payment = payments.find((p) => p.plan_id === plan.id && p.number === i + 1);
    return { number: i + 1, due: dueDateOf(plan, i), paid: Boolean(payment), payment };
  });
}

export type PlanProgress = {
  paid: number;
  total: number;
  remaining: number; // payments left
  remainingHalalas: number;
  next: Installment | null;
  done: boolean;
};

export function progressOf(plan: InstallmentPlan, payments: InstallmentPayment[]): PlanProgress {
  const sch = scheduleOf(plan, payments);
  const paid = sch.filter((s) => s.paid).length;
  const next = sch.find((s) => !s.paid) ?? null;
  return {
    paid, total: plan.total_count, remaining: plan.total_count - paid,
    remainingHalalas: (plan.total_count - paid) * plan.installment_halalas, next, done: paid >= plan.total_count,
  };
}
