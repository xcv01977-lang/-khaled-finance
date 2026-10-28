import { describe, expect, it } from "vitest";
import { cycleFor, dueDateInCycle, paydayOf, todayRiyadh } from "@/lib/cycle";

describe("paydayOf", () => {
  it("keeps the 27th on a normal weekday", () => {
    expect(paydayOf(2026, 9, 27)).toBe("2026-10-27"); // Tuesday
  });
  it("moves a Friday payday to Thursday", () => {
    expect(paydayOf(2026, 1, 27)).toBe("2026-02-26");
    expect(paydayOf(2026, 10, 27)).toBe("2026-11-26");
  });
  it("moves a Saturday payday to Sunday", () => {
    expect(paydayOf(2026, 5, 27)).toBe("2026-06-28");
  });
  it("does not shift when weekend_shift is off", () => {
    expect(paydayOf(2026, 10, 27, false)).toBe("2026-11-27");
  });
  it("clamps to the month length", () => {
    expect(paydayOf(2026, 1, 31, false)).toBe("2026-02-28");
  });
});

describe("cycleFor", () => {
  it("computes a cycle that spans a shifted payday", () => {
    const c = cycleFor("2026-10-28", 27);
    expect(c).toEqual({
      start: "2026-10-27", next: "2026-11-26", end: "2026-11-25",
      length: 30, day: 2, daysLeft: 29,
    });
  });
  it("day 1 is the payday itself", () => {
    const c = cycleFor("2026-10-27", 27);
    expect(c.start).toBe("2026-10-27");
    expect(c.day).toBe(1);
  });
  it("last day before payday has one day left", () => {
    const c = cycleFor("2026-11-25", 27);
    expect(c.start).toBe("2026-10-27");
    expect(c.day).toBe(30);
    expect(c.daysLeft).toBe(1);
  });
  it("switches cycle on the shifted payday, not on the 27th", () => {
    expect(cycleFor("2026-11-26", 27).start).toBe("2026-11-26");
    expect(cycleFor("2026-11-25", 27).start).toBe("2026-10-27");
  });
  it("crosses the year boundary", () => {
    const c = cycleFor("2026-01-10", 27);
    expect(c.start).toBe("2025-12-28"); // 27 Dec 2025 is a Saturday
    expect(c.next).toBe("2026-01-27");
  });
  it("respects a custom cycle day", () => {
    expect(cycleFor("2026-10-05", 1).start).toBe("2026-10-01");
  });
});

describe("dueDateInCycle", () => {
  const s = "2026-10-27";
  const e = "2026-11-25";
  it("finds the date in either month of the cycle", () => {
    expect(dueDateInCycle(1, s, e)).toBe("2026-11-01");
    expect(dueDateInCycle(30, s, e)).toBe("2026-10-30");
    expect(dueDateInCycle(27, s, e)).toBe("2026-10-27");
  });
  it("clamps day 31 to the shorter month", () => {
    expect(dueDateInCycle(31, "2026-11-26", "2026-12-26")).toBe("2026-11-30");
  });
  it("returns null when the day is outside the cycle", () => {
    // 26 Oct is before the cycle starts and 26 Nov is after it ends
    expect(dueDateInCycle(26, s, e)).toBeNull();
  });
});

describe("todayRiyadh", () => {
  it("uses Saudi time, which is UTC+3", () => {
    expect(todayRiyadh(new Date("2026-10-27T22:00:00Z"))).toBe("2026-10-28");
    expect(todayRiyadh(new Date("2026-10-27T20:59:00Z"))).toBe("2026-10-27");
  });
});
