import { addDays, diffDays } from "./cycle";
import { addMonths } from "./installments";
import { merchantKey } from "./sms/normalize";
import type { Tx } from "./types";

export type RecurringStatus = "ok" | "rose" | "missing";

export type Recurring = {
  key: string;
  name: string;
  period: "monthly" | "weekly";
  typical: number; // median amount, halalas
  last: number;
  previous: number | null;
  lastDate: string;
  nextExpected: string;
  count: number;
  /** Amount moves around (e.g. a phone bill), as opposed to a fixed subscription. */
  variable: boolean;
  status: RecurringStatus;
  /** Percent change of the latest charge, only for status "rose". */
  risePct: number | null;
  monthly: number; // what it costs per month
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const share = (xs: number[], lo: number, hi: number) => xs.filter((x) => x >= lo && x <= hi).length / xs.length;

/**
 * Charges that come back on a schedule: same merchant, one charge per period (monthly or weekly) with a steady
 * amount. Daily habits (coffee) and shopping with erratic amounts do not qualify.
 */
export function detectRecurring(txs: Tx[], today: string): Recurring[] {
  const groups = new Map<string, { name: string; byDate: Map<string, number> }>();
  for (const t of txs) {
    if (t.kind !== "expense") continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const g = groups.get(key) ?? groups.set(key, { name: t.merchant!, byDate: new Map() }).get(key)!;
    g.byDate.set(t.occurred_on, (g.byDate.get(t.occurred_on) ?? 0) + t.amount_halalas);
  }

  const out: Recurring[] = [];
  for (const [key, g] of groups) {
    const rows = [...g.byDate].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    if (rows.length < 3) continue;
    const dates = rows.map((r) => r[0]);
    const amounts = rows.map((r) => r[1]);
    const gaps = dates.slice(1).map((d, i) => diffDays(dates[i], d));
    const gap = median(gaps);

    const monthly = gap >= 26 && gap <= 35 && share(gaps, 25, 37) >= 0.7;
    const weekly = !monthly && rows.length >= 4 && gap >= 6 && gap <= 8 && share(gaps, 5, 9) >= 0.7;
    if (!monthly && !weekly) continue;

    const typical = median(amounts);
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / typical;
    if (spread > 0.35) continue;

    const last = amounts[amounts.length - 1];
    const previous = amounts.length >= 2 ? amounts[amounts.length - 2] : null;
    const before = amounts.length >= 3 ? amounts[amounts.length - 3] : null;
    const lastDate = dates[dates.length - 1];
    // A rise only counts when the charge was steady before it, so a bill that always moves is not flagged.
    const rose = previous !== null && before !== null && Math.abs(previous - before) <= previous * 0.05 && last > previous * 1.05;

    const nextExpected = monthly ? addMonths(lastDate, 1) : addDays(lastDate, 7);
    const grace = monthly ? 7 : 3;
    const periods = monthly ? 30 : 7;
    const late = diffDays(nextExpected, today) > grace;
    // Stop reporting once it has been gone for a couple of periods: it was cancelled, not forgotten.
    const stillRelevant = diffDays(lastDate, today) <= periods * 2.5;

    out.push({
      key, name: g.name, period: monthly ? "monthly" : "weekly", typical, last, previous, lastDate, nextExpected,
      count: rows.length, variable: spread > 0.1,
      status: rose ? "rose" : late && stillRelevant ? "missing" : "ok",
      risePct: rose ? Math.round(((last - previous!) / previous!) * 100) : null,
      monthly: monthly ? last : Math.round((last * 52) / 12),
    });
  }
  return out.filter((r) => diffDays(r.lastDate, today) <= (r.period === "monthly" ? 75 : 21)).sort((a, b) => b.monthly - a.monthly);
}
