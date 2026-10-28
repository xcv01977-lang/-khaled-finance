import { describe, expect, it } from "vitest";
import { detectRecurring } from "@/lib/recurring";
import type { Tx } from "@/lib/types";

const SAR = (n: number) => n * 100;
let n = 0;
const tx = (date: string, riyals: number, merchant: string | null, kind: Tx["kind"] = "expense"): Tx => ({
  id: `t${n++}`, amount_halalas: SAR(riyals), kind, category_id: null, merchant, note: null, occurred_on: date, source: "manual",
});
const today = "2026-10-28";

const monthly = (merchant: string, amounts: number[], day = 5, endMonth = 10) =>
  amounts.map((a, i) => {
    const m = endMonth - (amounts.length - 1 - i);
    const y = m <= 0 ? 2025 : 2026;
    const mm = m <= 0 ? m + 12 : m;
    return tx(`${y}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`, a, merchant);
  });

describe("detectRecurring", () => {
  it("finds a steady monthly subscription", () => {
    const [r] = detectRecurring(monthly("Netflix", [45, 45, 45, 45, 45]), today);
    expect(r).toMatchObject({ key: "netflix", period: "monthly", typical: SAR(45), last: SAR(45), count: 5, variable: false, status: "ok", monthly: SAR(45) });
    expect(r.nextExpected).toBe("2026-11-05");
  });

  it("flags a price rise only after a steady run", () => {
    const [r] = detectRecurring(monthly("Spotify", [20, 20, 20, 25]), today);
    expect(r).toMatchObject({ status: "rose", risePct: 25, previous: SAR(20), last: SAR(25) });
  });

  it("does not flag a bill that always moves", () => {
    const [r] = detectRecurring(monthly("STC", [180, 210, 195, 230]), today);
    expect(r.variable).toBe(true);
    expect(r.status).toBe("ok");
  });

  it("flags a charge that did not arrive this time", () => {
    // last charge 5 Sep; due 5 Oct; today is 28 Oct: three weeks late
    const [r] = detectRecurring(monthly("Shahid", [30, 30, 30, 30], 5, 9), today);
    expect(r.status).toBe("missing");
  });

  it("stops reporting a subscription that disappeared long ago", () => {
    expect(detectRecurring(monthly("Old Gym", [100, 100, 100, 100], 5, 5), today)).toEqual([]);
  });

  it("ignores daily habits, erratic shopping and merchants with too little history", () => {
    const coffee = Array.from({ length: 20 }, (_, i) => tx(`2026-10-${String(i + 1).padStart(2, "0")}`, 18, "Starbucks"));
    const shop = monthly("Noon", [50, 400, 90, 700]);
    const two = monthly("Gym", [100, 100]);
    expect(detectRecurring([...coffee, ...shop, ...two], today)).toEqual([]);
  });

  it("detects a weekly charge and converts it to a monthly cost", () => {
    // 30 Sep, then every 7 days to 28 Oct
    const dates = ["2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"].map((d) => tx(d, 30, "Laundry"));
    const [r] = detectRecurring(dates, today);
    expect(r).toMatchObject({ period: "weekly", monthly: Math.round((SAR(30) * 52) / 12), status: "ok" });
  });

  it("ignores refunds and transactions without a merchant", () => {
    const noMerchant = [0, 1, 2, 3].map((i) => tx(`2026-0${6 + i}-05`, 45, null));
    const refunds = monthly("Netflix", [45, 45, 45, 45]).map((t) => ({ ...t, kind: "refund" as const }));
    expect(detectRecurring([...noMerchant, ...refunds], today)).toEqual([]);
  });

  it("groups branches and cities of the same merchant", () => {
    const mixed = [tx("2026-07-05", 45, "NETFLIX RIYADH"), tx("2026-08-05", 45, "Netflix"), tx("2026-09-05", 45, "netflix jeddah 123"), tx("2026-10-05", 45, "Netflix")];
    expect(detectRecurring(mixed, today)).toHaveLength(1);
  });

  it("sorts by monthly cost, biggest first", () => {
    const r = detectRecurring([...monthly("Small", [10, 10, 10, 10]), ...monthly("Big", [300, 300, 300, 300])], today);
    expect(r.map((x) => x.key)).toEqual(["big", "small"]);
  });
});
