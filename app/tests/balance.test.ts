import { describe, expect, it } from "vitest";
import { closedCycles, computeBalance, defaultLine, lineIdOf, plannedFor, withPlan } from "@/lib/balance";
import { cycleFor } from "@/lib/cycle";
import { DEFAULT_SETTINGS, type Category, type Line, type Tx } from "@/lib/types";

const SAR = (n: number) => n * 100;
const settings = { ...DEFAULT_SETTINGS };

const mkLine = (over: Partial<Line> = {}): Line => ({
  id: "L1", name: "مصاريف", emoji: "💸", kind: "expenses", counts_daily: true,
  plans: [{ from: "2026-07-27", amount_halalas: SAR(5000) }],
  opening_halalas: 0, tracking_start: "2026-07-27", sort: 0, active: true, ...over,
});
const cat = (id: string, line_id: string | null): Category => ({ id, name: id, emoji: "📌", sort: 0, line_id });
let n = 0;
const tx = (day: string, riyals: number, category_id: string | null = null, kind: Tx["kind"] = "expense"): Tx => ({
  id: `t${n++}`, amount_halalas: SAR(riyals), kind, category_id, merchant: null, note: null,
  occurred_on: day, source: "manual",
});

// Paydays: Jul 27 (Mon), Aug 27 (Thu), Sep 27 (Sun), Oct 27 (Tue); none fall on Fri/Sat so none shift.
// Today 2026-10-28 is day 2 of the Oct 27 cycle. Closed cycles for a Jul 27 start: Jul 27, Aug 27, Sep 27.

describe("plans", () => {
  it("uses the plan in force for each cycle", () => {
    const l = mkLine({ plans: [
      { from: "2026-07-27", amount_halalas: SAR(5000) },
      { from: "2026-09-27", amount_halalas: SAR(6000) },
    ] });
    expect(plannedFor(l, "2026-08-27")).toBe(SAR(5000));
    expect(plannedFor(l, "2026-09-27")).toBe(SAR(6000));
    expect(plannedFor(l, "2026-06-27")).toBe(0);
  });
  it("replaces a plan set in the same cycle instead of stacking", () => {
    const p = withPlan([{ from: "2026-10-27", amount_halalas: 1 }], "2026-10-27", 2);
    expect(p).toEqual([{ from: "2026-10-27", amount_halalas: 2 }]);
  });
});

describe("closedCycles", () => {
  it("lists every finished cycle from the tracking start", () => {
    const cur = cycleFor("2026-10-28", 27, true);
    const c = closedCycles("2026-07-27", cur, 27, true);
    expect(c.map((x) => x.start)).toEqual(["2026-07-27", "2026-08-27", "2026-09-27"]);
  });
  it("skips a partial first cycle when tracking starts mid-cycle", () => {
    const cur = cycleFor("2026-10-28", 27, true);
    const c = closedCycles("2026-08-10", cur, 27, true);
    expect(c[0].start).toBe("2026-08-27");
  });
  it("has nothing closed when tracking starts in the current cycle", () => {
    const cur = cycleFor("2026-10-28", 27, true);
    expect(closedCycles("2026-10-27", cur, 27, true)).toEqual([]);
  });
});

describe("surplus and deficit", () => {
  it("accumulates an untouched plan: 3 closed cycles × 5000 = 15000 surplus", () => {
    const b = computeBalance({ today: "2026-10-28", settings, lines: [mkLine()], categories: [], txs: [] });
    expect(b.lines[0].closed).toBe(SAR(15000));
    expect(b.lines[0].remaining).toBe(SAR(5000));
    expect(b.lines[0].effective).toBe(SAR(20000));
    expect(b.total).toBe(SAR(20000));
  });

  it("each cycle contributes planned minus spent, and overspend subtracts", () => {
    const txs = [
      tx("2026-07-30", 4000), // Jul cycle: +1000
      tx("2026-08-30", 5000), // Aug cycle: 0
      tx("2026-10-01", 5600), // Sep cycle: -600
    ];
    const b = computeBalance({ today: "2026-10-28", settings, lines: [mkLine()], categories: [], txs });
    expect(b.lines[0].closed).toBe(SAR(400));
  });

  it("covers a current-cycle deficit from stored surplus and says so", () => {
    const b = computeBalance({
      today: "2026-10-28", settings, lines: [mkLine({ tracking_start: "2026-09-27" })], categories: [],
      txs: [tx("2026-10-28", 5500)],
    });
    const l = b.lines[0];
    expect(l.closed).toBe(SAR(5000)); // one untouched closed cycle
    expect(l.remaining).toBe(-SAR(500));
    expect(l.effective).toBe(SAR(4500));
    expect(l.coveredFromSurplus).toBe(true);
  });

  it("goes negative when the deficit is larger than the stored surplus", () => {
    const b = computeBalance({
      today: "2026-10-28", settings, lines: [mkLine({ tracking_start: "2026-09-27" })], categories: [],
      txs: [tx("2026-10-28", 11000)],
    });
    expect(b.lines[0].effective).toBe(-SAR(1000));
    expect(b.lines[0].coveredFromSurplus).toBe(false);
    expect(b.total).toBeLessThan(0);
  });

  it("does not move surplus between lines", () => {
    const lines = [
      mkLine({ tracking_start: "2026-09-27" }),
      mkLine({ id: "L2", name: "استثمار", kind: "investment", counts_daily: false, sort: 1, tracking_start: "2026-09-27",
        plans: [{ from: "2026-07-27", amount_halalas: SAR(1000) }] }),
    ];
    const cats = [cat("inv", "L2")];
    const b = computeBalance({
      today: "2026-10-28", settings, lines, categories: cats, txs: [tx("2026-10-28", 7000)],
    });
    expect(b.lines.find((x) => x.line.id === "L1")!.effective).toBe(SAR(5000 + 5000 - 7000));
    expect(b.lines.find((x) => x.line.id === "L2")!.effective).toBe(SAR(1000 + 1000));
  });

  it("keeps the old plan for closed cycles after the plan changes", () => {
    const line = mkLine({
      tracking_start: "2026-07-27",
      plans: [{ from: "2026-07-27", amount_halalas: SAR(5000) }, { from: "2026-10-27", amount_halalas: SAR(9000) }],
    });
    const b = computeBalance({ today: "2026-10-28", settings, lines: [line], categories: [], txs: [] });
    expect(b.lines[0].closed).toBe(SAR(15000)); // unchanged by the new 9000 plan
    expect(b.lines[0].planned).toBe(SAR(9000));
  });

  it("includes the opening balance, including a negative one", () => {
    const b = computeBalance({
      today: "2026-10-28", settings, lines: [mkLine({ opening_halalas: -SAR(300), tracking_start: "2026-10-27" })],
      categories: [], txs: [],
    });
    expect(b.lines[0].closed).toBe(-SAR(300));
  });

  it("routes spending by category line, falls back to the default line, and nets refunds", () => {
    const lines = [mkLine(), mkLine({ id: "L2", name: "ترفيه", kind: "custom", counts_daily: false, sort: 1 })];
    const cats = [cat("fun", "L2"), cat("food", null)];
    const t1 = tx("2026-10-28", 100, "fun");
    const t2 = tx("2026-10-28", 40, "food");
    const t3 = tx("2026-10-28", 10, null);
    const t4 = tx("2026-10-28", 25, "fun", "refund");
    expect(lineIdOf(t1, cats, lines)).toBe("L2");
    expect(lineIdOf(t2, cats, lines)).toBe("L1");
    expect(lineIdOf(t3, cats, lines)).toBe("L1");
    const b = computeBalance({ today: "2026-10-28", settings, lines, categories: cats, txs: [t1, t2, t3, t4] });
    expect(b.lines.find((x) => x.line.id === "L1")!.spent).toBe(SAR(50));
    expect(b.lines.find((x) => x.line.id === "L2")!.spent).toBe(SAR(75));
  });

  it("ignores inactive lines and picks the default line by sort order", () => {
    const lines = [mkLine({ id: "A", sort: 2 }), mkLine({ id: "B", sort: 1 }), mkLine({ id: "C", sort: 0, active: false })];
    expect(defaultLine(lines)!.id).toBe("B");
    const b = computeBalance({ today: "2026-10-28", settings, lines, categories: [], txs: [] });
    expect(b.lines.map((l) => l.line.id)).toEqual(["B", "A"]);
  });

  it("returns zero totals with no lines", () => {
    const b = computeBalance({ today: "2026-10-28", settings, lines: [], categories: [], txs: [tx("2026-10-28", 10)] });
    expect(b.total).toBe(0);
    expect(b.lines).toEqual([]);
  });
});
