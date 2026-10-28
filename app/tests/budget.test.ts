import { describe, expect, it } from "vitest";
import { summarize } from "@/lib/budget";
import { DEFAULT_SETTINGS, type Category, type Commitment, type InstallmentPayment, type InstallmentPlan, type Line, type Payment, type Tx } from "@/lib/types";

const SAR = (n: number) => n * 100;
const settings = { ...DEFAULT_SETTINGS, salary_halalas: SAR(10000) };

const commitments: Commitment[] = [
  { id: "rent", name: "الإيجار", emoji: "🏠", amount_halalas: SAR(3200), due_day: 1, active: true },
  { id: "tabby", name: "تابي", emoji: "🛍️", amount_halalas: SAR(450), due_day: 28, active: true },
];

let n = 0;
const tx = (day: string, riyals: number, kind: Tx["kind"] = "expense"): Tx => ({
  id: `t${n++}`, amount_halalas: SAR(riyals), kind, category_id: null,
  merchant: null, note: null, occurred_on: day, source: "manual",
});

describe("summarize", () => {
  it("takes fixed commitments off the salary before computing the daily number", () => {
    const s = summarize({ today: "2026-10-28", settings, txs: [], commitments, payments: [] });
    expect(s.commitmentsTotal).toBe(SAR(3650));
    expect(s.pool).toBe(SAR(6350));
    expect(s.dailyBudget).toBe(SAR(211)); // 6350 / 30 days, floored to whole riyals
    expect(s.cycle.daysLeft).toBe(29);
    expect(s.allowedToday).toBe(Math.round(SAR(6350) / 29));
  });

  it("subtracts today's spending from today's allowance only", () => {
    const base = summarize({ today: "2026-10-28", settings, txs: [], commitments, payments: [] });
    const s = summarize({
      today: "2026-10-28", settings, commitments, payments: [],
      txs: [tx("2026-10-28", 18)],
    });
    expect(s.spentToday).toBe(SAR(18));
    expect(s.allowedToday).toBe(Math.round((SAR(6350)) / 29) - SAR(18));
    expect(base.allowedToday - s.allowedToday).toBe(SAR(18));
  });

  it("spreads yesterday's overspend over the remaining days", () => {
    const s = summarize({
      today: "2026-10-29", settings, commitments, payments: [],
      txs: [tx("2026-10-28", 500)],
    });
    expect(s.cycle.daysLeft).toBe(28);
    expect(s.allowedToday).toBe(Math.round((SAR(6350) - SAR(500)) / 28));
  });

  it("goes negative when today's spending passes the allowance", () => {
    const s = summarize({
      today: "2026-10-28", settings, commitments, payments: [],
      txs: [tx("2026-10-28", 400)],
    });
    expect(s.allowedToday).toBeLessThan(0);
    expect(s.alerts.map((a) => a.id)).toContain("over-today");
  });

  it("ignores spending from the previous cycle", () => {
    const s = summarize({
      today: "2026-10-28", settings, commitments, payments: [],
      txs: [tx("2026-10-26", 999)],
    });
    expect(s.spent).toBe(0);
  });

  it("counts refunds against spending", () => {
    const s = summarize({
      today: "2026-10-28", settings, commitments, payments: [],
      txs: [tx("2026-10-28", 100), tx("2026-10-28", 30, "refund")],
    });
    expect(s.spent).toBe(SAR(70));
  });

  it("uses an explicit spending budget and daily allowance when set", () => {
    const s = summarize({
      today: "2026-10-28",
      settings: { ...settings, spending_budget_halalas: SAR(3000), daily_allowance_halalas: SAR(100) },
      txs: [], commitments, payments: [],
    });
    expect(s.pool).toBe(SAR(3000));
    expect(s.dailyBudget).toBe(SAR(100));
  });

  it("projects surplus from the current pace once the cycle has a few days", () => {
    // day 11 of the 2026-10-27 cycle, 1100 spent => 100/day pace, 19 days left after today
    const s = summarize({
      today: "2026-11-06", settings, commitments, payments: [],
      txs: [tx("2026-10-30", 1100)],
    });
    expect(s.cycle.day).toBe(11);
    expect(s.projectedSurplus).toBe(Math.round(SAR(6350) - (SAR(1100) + (SAR(1100) / 11) * 19)));
  });

  it("flags unpaid commitments past due and clears them once paid", () => {
    const late = summarize({ today: "2026-11-02", settings, txs: [], commitments, payments: [] });
    const tabby = late.upcoming.find((u) => u.commitment?.id === "tabby")!;
    expect(tabby.status).toBe("overdue");
    expect(late.alerts.map((a) => a.id)).toContain("overdue");

    const payment: Payment = {
      id: "p1", commitment_id: "tabby", cycle_start: "2026-10-27",
      paid_on: "2026-11-02", amount_halalas: SAR(450),
    };
    const paid = summarize({ today: "2026-11-02", settings, txs: [], commitments, payments: [payment] });
    expect(paid.upcoming.find((u) => u.commitment?.id === "tabby")!.status).toBe("paid");
    expect(paid.commitmentsLeft).toBe(SAR(3200)); // rent is due Nov 1 and still unpaid
    expect(paid.commitmentsTotal).toBe(SAR(3650)); // total does not change when paid
  });

  it("orders upcoming payments by date and skips inactive ones", () => {
    const s = summarize({
      today: "2026-10-28", settings, txs: [], payments: [],
      commitments: [...commitments, { ...commitments[0], id: "x", active: false }],
    });
    expect(s.upcoming.map((u) => u.commitment?.id)).toEqual(["tabby", "rent"]);
  });

  it("never produces a negative pool from a salary smaller than commitments", () => {
    const s = summarize({
      today: "2026-10-28", settings: { ...settings, salary_halalas: SAR(1000) },
      txs: [], commitments, payments: [],
    });
    expect(s.pool).toBe(0);
  });

  describe("with budget lines", () => {
    const line = (over: Partial<Line>): Line => ({
      id: "L1", name: "مصاريف", emoji: "💸", kind: "expenses", counts_daily: true,
      plans: [{ from: "2026-10-27", amount_halalas: SAR(3000) }], opening_halalas: 0,
      tracking_start: "2026-10-27", sort: 0, active: true, ...over,
    });
    const cats: Category[] = [
      { id: "inv", name: "استثمار", emoji: "📈", sort: 0, line_id: "L2" },
      { id: "food", name: "أكل", emoji: "🍽️", sort: 1, line_id: "L1" },
    ];
    const lines = [
      line({}),
      line({ id: "L2", name: "استثمار", kind: "investment", counts_daily: false, sort: 1,
        plans: [{ from: "2026-10-27", amount_halalas: SAR(1500) }] }),
    ];

    it("takes the pool from the daily lines, not from the salary", () => {
      const s = summarize({ today: "2026-10-28", settings, txs: [], commitments, payments: [], lines, categories: cats });
      expect(s.pool).toBe(SAR(3000)); // salary and commitments no longer matter
    });

    it("counts only spending routed to daily lines against today's number", () => {
      const t = (c: string | null, r: number) => ({ ...tx("2026-10-28", r), category_id: c });
      const s = summarize({
        today: "2026-10-28", settings, commitments, payments: [], lines, categories: cats,
        txs: [t("food", 40), t(null, 10), t("inv", 700)],
      });
      expect(s.spentToday).toBe(SAR(50)); // the 700 went to investment
    });

    it("ignores lines that are switched off", () => {
      const s = summarize({
        today: "2026-10-28", settings, txs: [], commitments, payments: [], categories: cats,
        lines: [line({ active: false })],
      });
      expect(s.pool).toBe(SAR(6350)); // back to the salary-based pool
    });
  });

  describe("with instalment plans", () => {
    const plan = (over: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
      id: "noon", name: "نون", provider: "tabby", installment_halalas: SAR(125), total_count: 4,
      first_due: "2026-10-30", period: "monthly", active: true, ...over,
    });
    const paid = (number: number, plan_id = "noon"): InstallmentPayment => ({
      id: `ip${number}`, plan_id, number, paid_on: "2026-10-30", amount_halalas: SAR(125),
    });
    const run = (plans: InstallmentPlan[], planPayments: InstallmentPayment[] = [], today = "2026-10-28") =>
      summarize({ today, settings, txs: [], commitments: [], payments: [], plans, planPayments });

    it("lists only the payment due in this cycle and reduces the pool by it", () => {
      const s = run([plan()]);
      expect(s.upcoming).toHaveLength(1); // the next ones fall in later cycles
      expect(s.upcoming[0]).toMatchObject({ kind: "installment", name: "نون", detail: "دفعة 1 من 4", amount_halalas: SAR(125), due: "2026-10-30", status: "soon" });
      expect(s.commitmentsTotal).toBe(SAR(125));
      expect(s.pool).toBe(SAR(10000 - 125));
    });

    it("marks a paid payment as paid but still counts it in the cycle total", () => {
      const s = run([plan()], [paid(1)]);
      expect(s.upcoming[0].status).toBe("paid");
      expect(s.commitmentsLeft).toBe(0);
      expect(s.commitmentsTotal).toBe(SAR(125));
    });

    it("carries an unpaid payment from an earlier cycle as overdue and says which one", () => {
      const s = run([plan({ first_due: "2026-09-30" })]);
      expect(s.upcoming.map((u) => [u.number, u.status])).toEqual([[1, "overdue"], [2, "soon"]]);
      expect(s.commitmentsLeft).toBe(SAR(250));
      expect(s.alerts.find((a) => a.id === "overdue")!.text).toContain("دفعة 1 من 4");
    });

    it("a payment paid late is not overdue any more", () => {
      const s = run([plan({ first_due: "2026-09-30" })], [paid(1)]);
      expect(s.upcoming.map((u) => u.number)).toEqual([2]);
    });

    it("ignores inactive and finished plans", () => {
      expect(run([plan({ active: false })]).upcoming).toEqual([]);
      expect(run([plan({ total_count: 1, first_due: "2026-09-30" })], [paid(1)]).upcoming).toEqual([]);
    });

    it("biweekly plans can put two payments in one cycle", () => {
      const s = run([plan({ period: "biweekly", first_due: "2026-10-28" })]);
      expect(s.upcoming.map((u) => u.due)).toEqual(["2026-10-28", "2026-11-11", "2026-11-25"]);
    });

    it("commitments and plan payments are merged in date order", () => {
      const s = summarize({
        today: "2026-10-28", settings, txs: [], payments: [], planPayments: [], plans: [plan()],
        commitments: [{ id: "rent", name: "الإيجار", emoji: "🏠", amount_halalas: SAR(3200), due_day: 29, active: true }],
      });
      expect(s.upcoming.map((u) => u.kind)).toEqual(["commitment", "installment"]);
    });
  });
});
