import { describe, expect, it } from "vitest";
import { buildAlerts, weeklySummary, type AlertCtx } from "@/lib/alerts";
import { computeBalance } from "@/lib/balance";
import { summarize } from "@/lib/budget";
import { DEFAULT_SETTINGS, type Category, type Commitment, type Line, type Tx } from "@/lib/types";

const SAR = (n: number) => n * 100;
const cats: Category[] = [
  { id: "coffee", name: "قهوة", emoji: "☕", sort: 0, line_id: null },
  { id: "shop", name: "تسوق", emoji: "🛍️", sort: 1, line_id: null },
];
let n = 0;
const tx = (occurred_on: string, riyals: number, category_id: string | null, merchant: string | null = null, kind: Tx["kind"] = "expense"): Tx => ({
  id: `t${n++}`, amount_halalas: SAR(riyals), kind, category_id, merchant, note: null, occurred_on, source: "manual",
});

function ctx(today: string, txs: Tx[], opts: { budget?: number; lines?: Line[]; commitments?: Commitment[] } = {}): AlertCtx {
  const settings = { ...DEFAULT_SETTINGS, salary_halalas: SAR(10000), spending_budget_halalas: opts.budget === undefined ? SAR(3000) : SAR(opts.budget) };
  const lines = opts.lines ?? [];
  return {
    today, settings, categories: cats, txs,
    summary: summarize({ today, settings, txs, commitments: opts.commitments ?? [], payments: [], lines, categories: cats }),
    balance: computeBalance({ today, settings, lines, categories: cats, txs }),
  };
}
const ids = (c: AlertCtx) => buildAlerts(c).map((a) => a.id.split(":")[0]);

describe("alerts: unusual spending", () => {
  const history = ["2026-08-01", "2026-08-10", "2026-08-20", "2026-09-01", "2026-09-10", "2026-09-20"].map((d) => tx(d, 40, "shop", "نمشي"));

  it("flags a purchase several times the category's usual size", () => {
    const big = tx("2026-10-28", 600, "shop", "جرير");
    const a = buildAlerts(ctx("2026-10-28", [...history, big])).find((x) => x.id === `odd:${big.id}`)!;
    expect(a.tone).toBe("warn");
    expect(a.text).toContain("600 ر.س عند جرير في تسوق");
    expect(a.text).toContain("عادةً حوالي 40 ر.س");
  });
  it("is quiet about normal purchases and about small amounts that merely beat a tiny median", () => {
    expect(ids(ctx("2026-10-28", [...history, tx("2026-10-28", 55, "shop", "x")]))).not.toContain("odd");
    expect(ids(ctx("2026-10-28", [...history, tx("2026-10-28", 130, "shop", "x")]))).not.toContain("odd"); // under 150 SAR
  });
  it("needs enough history to judge", () => {
    expect(ids(ctx("2026-10-28", [...history.slice(0, 3), tx("2026-10-28", 900, "shop", "x")]))).not.toContain("odd");
  });
  it("only looks at the last few days", () => {
    expect(ids(ctx("2026-10-28", [...history, tx("2026-10-20", 900, "shop", "x")]))).not.toContain("odd");
  });
});

describe("alerts: duplicates", () => {
  it("flags the same amount at the same merchant twice on one day", () => {
    const c = ctx("2026-10-28", [tx("2026-10-28", 45, "coffee", "ستاربكس"), tx("2026-10-28", 45, "coffee", "ستاربكس الرياض")]);
    const a = buildAlerts(c).find((x) => x.id.startsWith("dup:"));
    expect(a?.text).toContain("سُجّلت 2 مرات");
  });
  it("does not flag different amounts, different days or merchantless entries", () => {
    expect(ids(ctx("2026-10-28", [tx("2026-10-28", 45, null, "ستاربكس"), tx("2026-10-28", 46, null, "ستاربكس")]))).not.toContain("dup");
    expect(ids(ctx("2026-10-28", [tx("2026-10-27", 45, null, "ستاربكس"), tx("2026-10-28", 45, null, "ستاربكس")]))).not.toContain("dup");
    expect(ids(ctx("2026-10-28", [tx("2026-10-28", 45, "coffee"), tx("2026-10-28", 45, "coffee")]))).not.toContain("dup");
  });
});

describe("alerts: limits", () => {
  const line = (over: Partial<Line> = {}): Line => ({
    id: "L", name: "مصاريف", emoji: "💸", kind: "expenses", counts_daily: true,
    plans: [{ from: "2026-10-27", amount_halalas: SAR(1000) }], opening_halalas: 0, tracking_start: "2026-10-27", sort: 0, active: true, ...over,
  });
  it("warns at 80% and turns red when the plan is passed", () => {
    const near = buildAlerts(ctx("2026-10-28", [tx("2026-10-28", 850, null)], { lines: [line()] })).find((a) => a.id.startsWith("line:"))!;
    expect(near).toMatchObject({ tone: "warn" });
    expect(near.text).toContain("اقتربت من حد بند مصاريف: صرفت 85% وباقي 150 ر.س");
    const over = buildAlerts(ctx("2026-10-28", [tx("2026-10-28", 1200, null)], { lines: [line()] })).find((a) => a.id.startsWith("line:"))!;
    expect(over.tone).toBe("bad");
  });
  it("says when a closed-cycle surplus covers the overspend", () => {
    const l = line({ tracking_start: "2026-09-27", plans: [{ from: "2026-09-27", amount_halalas: SAR(1000) }] });
    const a = buildAlerts(ctx("2026-10-28", [tx("2026-10-28", 1200, null)], { lines: [l] })).find((x) => x.id.startsWith("line:"))!;
    expect(a.text).toContain("تغطّى من فائضك المتراكم");
  });
  it("is silent below 80%", () => {
    expect(ids(ctx("2026-10-28", [tx("2026-10-28", 300, null)], { lines: [line()] }))).not.toContain("line");
  });
  it("without lines, watches the whole spending budget", () => {
    expect(ids(ctx("2026-10-28", [tx("2026-10-28", 2700, null)]))).toContain("pool");
  });
});

describe("alerts: payments and ordering", () => {
  it("overdue payments are red and cannot be dismissed", () => {
    const c = ctx("2026-11-02", [], { commitments: [{ id: "r", name: "الإيجار", emoji: "🏠", amount_halalas: SAR(3200), due_day: 28, active: true }] });
    const a = buildAlerts(c)[0];
    expect(a).toMatchObject({ tone: "bad", dismissible: false });
    expect(a.text).toContain("الإيجار");
  });
  it("orders red before yellow before info", () => {
    const history = ["2026-08-01", "2026-08-10", "2026-08-20", "2026-09-01", "2026-09-10"].map((d) => tx(d, 40, "shop", "نمشي"));
    const c = ctx("2026-10-29", [...history, tx("2026-10-29", 900, "shop", "جرير")], { commitments: [{ id: "r", name: "x", emoji: "🏠", amount_halalas: SAR(10), due_day: 28, active: true }] });
    const tones = buildAlerts(c).map((a) => a.tone);
    expect(tones).toEqual([...tones].sort((a, b) => ["bad", "warn", "info"].indexOf(a) - ["bad", "warn", "info"].indexOf(b)));
  });
  it("alert ids stay the same from one day to the next so a dismissal sticks", () => {
    const base = [tx("2026-10-27", 45, "coffee", "ستاربكس"), tx("2026-10-27", 45, "coffee", "ستاربكس")];
    const a1 = buildAlerts(ctx("2026-10-28", base)).find((x) => x.id.startsWith("dup:"))!;
    const a2 = buildAlerts(ctx("2026-10-29", base)).find((x) => x.id.startsWith("dup:"))!;
    expect(a1.id).toBe(a2.id);
  });
});

describe("alerts: recurring and weekly", () => {
  const monthly = (m: string, amounts: number[]) => amounts.map((a, i) => tx(`2026-${String(10 - (amounts.length - 1 - i)).padStart(2, "0")}-05`, a, null, m));
  it("reports a subscription price rise", () => {
    const a = buildAlerts(ctx("2026-10-28", monthly("Spotify", [20, 20, 20, 25]))).find((x) => x.id.startsWith("rise:"))!;
    expect(a.text).toContain("Spotify ارتفع من 20 ر.س إلى 25 ر.س (+25%)");
    expect(a.action).toBe("recurring");
  });
  it("offers the weekly summary on Thursday and Friday only", () => {
    // 2026-10-29 is a Thursday
    expect(ids(ctx("2026-10-29", []))).toContain("week");
    expect(ids(ctx("2026-10-30", []))).toContain("week");
    expect(ids(ctx("2026-10-28", []))).not.toContain("week");
    expect(buildAlerts(ctx("2026-10-29", [])).find((a) => a.id.startsWith("week:"))!.id).toBe("week:2026-10-29");
    expect(buildAlerts(ctx("2026-10-30", [])).find((a) => a.id.startsWith("week:"))!.id).toBe("week:2026-10-29");
  });
  it("summarises the week against the one before", () => {
    const t = [tx("2026-10-28", 100, "coffee"), tx("2026-10-25", 200, "shop"), tx("2026-10-18", 150, "shop")];
    const s = weeklySummary(ctx("2026-10-29", t));
    expect(s[0]).toContain("صرفت 300 ر.س آخر ٧ أيام (2 عملية)");
    expect(s[1]).toContain("أكثر من الأسبوع اللي قبله بـ 150 ر.س");
    expect(s[2]).toContain("تسوق");
  });
  it("handles an empty week", () => {
    expect(weeklySummary(ctx("2026-10-29", []))).toEqual(["ما سجّلت صرف آخر ٧ أيام."]);
  });
});
