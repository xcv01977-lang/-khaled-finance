import { describe, expect, it } from "vitest";
import { goalStatus } from "@/lib/goals";
import type { Goal, GoalContribution } from "@/lib/types";

const SAR = (n: number) => n * 100;
const today = "2026-10-28";
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1", name: "سفر", emoji: "✈️", target_halalas: SAR(12000), monthly_halalas: null, deadline: null,
  created_on: "2026-06-01", ...over,
});
let n = 0;
const put = (on: string, riyals: number, goal_id = "g1"): GoalContribution => ({ id: `c${n++}`, goal_id, amount_halalas: SAR(riyals), on });

describe("goalStatus", () => {
  it("sums contributions for this goal only and never goes below zero", () => {
    const s = goalStatus(goal(), [put("2026-09-01", 1000), put("2026-10-01", 500), put("2026-10-01", 9999, "other")], today);
    expect(s).toMatchObject({ saved: SAR(1500), remaining: SAR(10500) });
    expect(goalStatus(goal(), [put("2026-10-01", -300)], today).saved).toBe(0);
  });

  it("uses the planned monthly amount for the estimate", () => {
    const s = goalStatus(goal({ monthly_halalas: SAR(1000) }), [put("2026-10-01", 2000)], today);
    expect(s).toMatchObject({ rate: SAR(1000), rateSource: "planned", etaMonths: 10, etaDate: "2027-08-28" });
  });

  it("reads the pace from the last 90 days when nothing is planned", () => {
    // 3 × 1000 in the last 90 days => 1000 / month; older money does not count toward the pace
    const s = goalStatus(goal(), [put("2026-08-05", 1000), put("2026-09-05", 1000), put("2026-10-05", 1000), put("2026-03-01", 5000)], today);
    expect(s.rateSource).toBe("history");
    expect(s.rate).toBe(Math.round((SAR(3000) / 90) * 30));
    expect(s.saved).toBe(SAR(8000));
  });

  it("has no estimate without a pace, rather than inventing one", () => {
    const s = goalStatus(goal(), [], today);
    expect(s).toMatchObject({ rate: null, etaMonths: null, etaDate: null, boost: null });
  });

  it("suggests an extra amount that arrives sooner", () => {
    const s = goalStatus(goal({ monthly_halalas: SAR(500) }), [], today);
    expect(s.etaMonths).toBe(24);
    expect(s.boost).toEqual({ extra: SAR(100), months: 20, saves: 4 });
  });

  it("does not suggest anything when the goal is one payment away", () => {
    expect(goalStatus(goal({ monthly_halalas: SAR(20000) }), [], today).boost).toBeNull();
  });

  it("works out what a deadline requires and whether the pace meets it", () => {
    const behind = goalStatus(goal({ deadline: "2027-04-28", monthly_halalas: SAR(1000) }), [put("2026-10-01", 6000)], today);
    expect(behind.neededMonthly).toBe(Math.ceil(SAR(6000) / 6));
    expect(behind.onTrack).toBe(true); // 6 months left, 6000 to go, pace 1000
    const late = goalStatus(goal({ deadline: "2027-02-28", monthly_halalas: SAR(1000) }), [put("2026-10-01", 6000)], today);
    expect(late.onTrack).toBe(false);
    expect(late.neededMonthly).toBeGreaterThan(SAR(1000));
  });

  it("a deadline in the past needs everything now", () => {
    const s = goalStatus(goal({ deadline: "2026-10-01", monthly_halalas: SAR(1000) }), [], today);
    expect(s.neededMonthly).toBe(SAR(12000));
    expect(s.onTrack).toBe(false);
  });

  it("is done when the target is reached", () => {
    const s = goalStatus(goal(), [put("2026-10-01", 12000)], today);
    expect(s).toMatchObject({ done: true, remaining: 0, pct: 1, etaMonths: 0 });
  });
});
