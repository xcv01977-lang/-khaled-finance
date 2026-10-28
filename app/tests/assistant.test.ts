import { describe, expect, it } from "vitest";
import { answer, type Ctx } from "@/lib/assistant";
import { computeBalance } from "@/lib/balance";
import { summarize } from "@/lib/budget";
import { DEFAULT_SETTINGS, type Category, type Commitment, type Goal, type GoalContribution, type InstallmentPlan, type Tx } from "@/lib/types";

const SAR = (n: number) => n * 100;
const today = "2026-10-28"; // day 2 of the 27 Oct cycle; the previous cycle began 27 Sep

const cats: Category[] = [
  { id: "coffee", name: "قهوة", emoji: "☕", sort: 0, line_id: null },
  { id: "food", name: "مطاعم", emoji: "🍽️", sort: 1, line_id: null },
  { id: "fuel", name: "بنزين", emoji: "⛽", sort: 2, line_id: null },
  { id: "groc", name: "بقالة", emoji: "🛒", sort: 3, line_id: null },
];
let n = 0;
const tx = (occurred_on: string, riyals: number, category_id: string | null, merchant: string | null = null, kind: Tx["kind"] = "expense"): Tx => ({
  id: `t${n++}`, amount_halalas: SAR(riyals), kind, category_id, merchant, note: null, occurred_on, source: "manual",
});

const txs: Tx[] = [
  tx("2026-10-28", 18, "coffee", "ستاربكس"),
  tx("2026-10-28", 34, "food", "ألبيك"),
  tx("2026-10-27", 90, "fuel", "ساسكو"),
  // previous cycle
  tx("2026-09-27", 50, "coffee", "ستاربكس"),
  tx("2026-09-28", 100, "food", "ألبيك"),
  tx("2026-10-10", 500, "groc", "بنده"),
];
const commitments: Commitment[] = [
  { id: "rent", name: "الإيجار", emoji: "🏠", amount_halalas: SAR(3200), due_day: 1, active: true },
];

function ctx(over: Partial<Ctx> & { budget?: number | null; salary?: number } = {}): Ctx {
  const settings = { ...DEFAULT_SETTINGS, salary_halalas: SAR(over.salary ?? 10000), spending_budget_halalas: over.budget === undefined ? SAR(3000) : over.budget };
  const t = over.txs ?? txs;
  const summary = summarize({ today, settings, txs: t, commitments, payments: [], lines: [], categories: cats });
  const balance = computeBalance({ today, settings, lines: [], categories: cats, txs: t });
  return { today, settings, categories: cats, lines: [], txs: t, summary, balance };
}
const a = (q: string, c: Ctx = ctx()) => answer(q, c);

describe("assistant: spending questions", () => {
  it("total this cycle", () => {
    const r = a("كم صرفت هالدورة؟");
    expect(r).toContain("142 ر.س");
    expect(r).toContain("3 عمليات");
  });
  it("by category, with share and comparison with the same days of the previous cycle", () => {
    const r = a("كم صرفت على القهوة هالشهر؟");
    expect(r).toContain("18 ر.س على قهوة");
    expect(r).toContain("13%");
    expect(r).toContain("بنفس الفترة من الدورة اللي فاتت كان 50 ر.س");
    expect(r).toContain("أقل بـ 32 ر.س");
  });
  it("synonyms: الأكل covers restaurants and groceries", () => {
    expect(a("كم صرفت على الأكل هالدورة")).toContain("34 ر.س على مطاعم و");
  });
  it("by merchant name", () => {
    expect(a("كم صرفت عند ستاربكس؟")).toContain("18 ر.س عند ستاربكس");
  });
  it("other periods", () => {
    expect(a("كم صرفت أمس")).toContain("90 ر.س أمس");
    expect(a("كم صرفت أول أمس")).toContain("ما سجّلت أي صرف أول أمس");
    expect(a("كم صرفت الدورة اللي فاتت؟")).toContain("650 ر.س");
    expect(a("كم صرفت على المطاعم الدورة اللي فاتت")).toContain("100 ر.س على مطاعم الدورة اللي فاتت");
  });
  it("says so instead of answering with the total when the category does not exist", () => {
    const r = a("كم صرفت على الصحة هالدورة");
    expect(r).toContain("ما لقيت تصنيف أو محل باسم «الصحة»");
    expect(r).toContain("قهوة");
  });
  it("does not mistake a period word for a missing category", () => {
    expect(a("كم صرفت على هالدورة")).toContain("142 ر.س");
  });
  it("refunds reduce the total", () => {
    const t = [...txs, tx("2026-10-28", 40, "food", "ألبيك", "refund")];
    expect(a("كم صرفت هالدورة", ctx({ txs: t }))).toContain("102 ر.س");
  });
});

describe("assistant: top spending", () => {
  it("ranks categories with shares", () => {
    const r = a("وش أكثر شي يستهلك فلوسي؟");
    const order = ["بنزين", "مطاعم", "قهوة"].map((w) => r.indexOf(w));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(r).toContain("63%"); // 90 of 142
    expect(r).toContain("وأكثر محل: ساسكو بـ 90 ر.س");
  });
  it("warns when much of the spending is uncategorised", () => {
    const r = a("وش أكثر شي أصرف عليه", ctx({ txs: [tx("2026-10-28", 100, null)] }));
    expect(r).toContain("بدون تصنيف");
  });
});

describe("assistant: can I buy this", () => {
  it("yes when it fits inside today's allowance", () => {
    const c = ctx();
    const r = a("أقدر أشتري سماعة بـ 20؟", c);
    expect(r.startsWith("تقدر. تدخل في مخصص اليوم")).toBe(true);
  });
  it("yes but with the cost to the daily number when it fits the cycle", () => {
    const r = a("أقدر أشتري شي بـ 800؟");
    expect(r).toContain("تقدر، بس مخصصك اليومي ينزل");
    expect(r).toContain("بعد 29 يوم");
  });
  it("squeezes: allowed on paper but honest that it hurts", () => {
    const r = a("أقدر أشتري شي بـ 2000؟");
    expect(r).toContain("تضغطك");
    expect(r).toContain("تأجلها");
  });
  it("no when it blows the budget", () => {
    const r = a("أقدر أشتري شي بـ 5000؟");
    expect(r.startsWith("لا.")).toBe(true);
    expect(r).toContain("تتجاوز ميزانيتك بـ");
  });
  it("mentions remaining commitments", () => {
    expect(a("أقدر أشتري شي بـ 800؟")).toContain("التزامات باقية 3,200 ر.س");
  });
  it("asks for the price when none is given", () => {
    expect(a("أقدر أشتري جوال؟")).toContain("كم سعرها");
  });
  it("refuses to judge without a budget", () => {
    expect(a("أقدر أشتري شي بـ 800؟", ctx({ budget: null, salary: 0 }))).toContain("ما حددت راتبك");
  });
});

describe("assistant: status, upcoming, compare", () => {
  it("status line", () => {
    const r = a("وش وضعي؟");
    expect(r).toContain("تقدر تصرف اليوم");
    expect(r).toContain("صرفت هالدورة 142 ر.س من 3,000 ر.س");
    expect(r).toContain("باقي 29 يوم");
  });
  it("upcoming payments", () => {
    const r = a("وش المدفوعات القادمة؟");
    expect(r).toContain("عليك 3,200 ر.س");
    expect(r).toContain("الإيجار");
    expect(r).toContain("بعد 4 يوم");
  });
  it("compare with the previous cycle at the same day", () => {
    const r = a("قارن بالدورة اللي فاتت");
    expect(r).toContain("صرفت 142 ر.س");
    expect(r).toContain("بنفس الفترة قبلها 150 ر.س");
    expect(r).toContain("أقل بـ 8 ر.س");
  });
  it("daily allowance", () => {
    expect(a("كم أصرف يومياً؟")).toContain("مخصصك اليومي 100 ر.س");
  });
});

describe("assistant: fallback", () => {
  it("never guesses", () => {
    expect(a("السلام عليكم")).toContain("ما فهمت سؤالك");
    expect(a("")).toContain("ما فهمت سؤالك");
  });
});

describe("assistant: goals and instalments", () => {
  const goal: Goal = { id: "g", name: "سفر", emoji: "✈️", target_halalas: SAR(12000), monthly_halalas: SAR(500), deadline: null, created_on: "2026-06-01" };
  const put: GoalContribution = { id: "c", goal_id: "g", amount_halalas: SAR(2000), on: "2026-10-01" };
  const plan: InstallmentPlan = { id: "p", name: "نون", provider: "tabby", installment_halalas: SAR(125), total_count: 4, first_due: "2026-10-30", period: "monthly", active: true };

  it("tells when a goal will be reached and how to be faster", () => {
    const r = a("متى أوصل هدفي؟", { ...ctx(), goals: [goal], contributions: [put] });
    expect(r).toContain("سفر: 2,000 ر.س من 12,000 ر.س (17%)");
    expect(r).toContain("بمعدل 500 ر.س شهرياً توصل بعد 20 أشهر");
    expect(r).toContain("لو زدت 100 ر.س شهرياً");
  });
  it("asks for a goal when there is none", () => {
    expect(a("كم باقي على هدفي؟")).toContain("ما أضفت أهداف");
  });
  it("sums what is left on instalment plans", () => {
    const r = a("كم باقي علي من تابي؟", { ...ctx(), plans: [plan], planPayments: [] });
    expect(r).toContain("باقي عليك 500 ر.س من الأقساط");
    expect(r).toContain("نون: دفعة 1 من 4");
  });
  it("says so when there are no instalments", () => {
    expect(a("كم باقي علي من الأقساط؟")).toContain("ما عليك أقساط جارية");
  });
});
