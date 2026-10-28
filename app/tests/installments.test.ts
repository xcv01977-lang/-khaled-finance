import { describe, expect, it } from "vitest";
import { addMonths, dueDateOf, progressOf, scheduleOf } from "@/lib/installments";
import type { InstallmentPayment, InstallmentPlan } from "@/lib/types";

const plan = (over: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
  id: "p1", name: "نون", provider: "tabby", installment_halalas: 12500, total_count: 4,
  first_due: "2026-10-30", period: "monthly", active: true, ...over,
});

describe("dates", () => {
  it("adds months keeping the day, clamped to short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31"); // the anchor day is kept, not the clamped one
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("monthly, biweekly and weekly schedules", () => {
    expect([0, 1, 2, 3].map((k) => dueDateOf(plan(), k))).toEqual(["2026-10-30", "2026-11-30", "2026-12-30", "2027-01-30"]);
    expect([0, 1, 2].map((k) => dueDateOf(plan({ period: "biweekly" }), k))).toEqual(["2026-10-30", "2026-11-13", "2026-11-27"]);
    expect([0, 1].map((k) => dueDateOf(plan({ period: "weekly" }), k))).toEqual(["2026-10-30", "2026-11-06"]);
  });
});

describe("progress", () => {
  const pay = (number: number): InstallmentPayment => ({ id: `x${number}`, plan_id: "p1", number, paid_on: "2026-10-30", amount_halalas: 12500 });

  it("a new plan has everything ahead", () => {
    const p = progressOf(plan(), []);
    expect(p).toMatchObject({ paid: 0, remaining: 4, remainingHalalas: 50000, done: false });
    expect(p.next).toMatchObject({ number: 1, due: "2026-10-30" });
  });
  it("counts paid payments and finds the next unpaid one, even out of order", () => {
    const p = progressOf(plan(), [pay(1), pay(3)]);
    expect(p).toMatchObject({ paid: 2, remaining: 2, remainingHalalas: 25000 });
    expect(p.next).toMatchObject({ number: 2, due: "2026-11-30" });
  });
  it("is done when every payment is paid", () => {
    const p = progressOf(plan(), [1, 2, 3, 4].map(pay));
    expect(p).toMatchObject({ done: true, remaining: 0, next: null });
  });
  it("ignores payments that belong to other plans", () => {
    const other: InstallmentPayment = { ...pay(1), plan_id: "other" };
    expect(scheduleOf(plan(), [other]).every((s) => !s.paid)).toBe(true);
  });
});
