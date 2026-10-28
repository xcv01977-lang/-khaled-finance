import { cycleFor, type Cycle } from "./cycle";
import type { Category, Line, Plan, Settings, Tx } from "./types";

const MAX_CYCLES = 240;

const net = (t: Tx) => (t.kind === "refund" ? -t.amount_halalas : t.amount_halalas);

/** The plan in force for a cycle: the latest one that starts on or before it. */
export function plannedFor(line: Pick<Line, "plans">, cycleStart: string): number {
  let found = 0;
  let from = "";
  for (const p of line.plans) {
    if (p.from <= cycleStart && p.from >= from) {
      found = p.amount_halalas;
      from = p.from;
    }
  }
  return found;
}

/** Record a new planned amount from this cycle on, replacing any plan already set for it. */
export function withPlan(plans: Plan[], cycleStart: string, amount_halalas: number): Plan[] {
  const rest = plans.filter((p) => p.from !== cycleStart);
  return [...rest, { from: cycleStart, amount_halalas }].sort((a, b) => a.from.localeCompare(b.from));
}

/** The line that new, uncategorised spending falls into: the first active daily line. */
export function defaultLine(lines: Line[]): Line | null {
  return [...lines].filter((l) => l.active && l.counts_daily).sort((a, b) => a.sort - b.sort)[0] ?? null;
}

/** Which active line a transaction belongs to (through its category), or null if none. */
export function lineIdOf(tx: Tx, categories: Category[], lines: Line[]): string | null {
  const active = new Set(lines.filter((l) => l.active).map((l) => l.id));
  const cat = categories.find((c) => c.id === tx.category_id);
  if (cat?.line_id && active.has(cat.line_id)) return cat.line_id;
  return defaultLine(lines)?.id ?? null;
}

/** Full cycles that ended before the current one and count toward a line's cumulative surplus. */
export function closedCycles(trackingStart: string, current: Cycle, cycleDay: number, shift: boolean): Cycle[] {
  const out: Cycle[] = [];
  let c = cycleFor(trackingStart, cycleDay, shift);
  if (c.start < trackingStart) c = cycleFor(c.next, cycleDay, shift);
  while (c.start < current.start && out.length < MAX_CYCLES) {
    out.push(c);
    c = cycleFor(c.next, cycleDay, shift);
  }
  return out;
}

export type LineBalance = {
  line: Line;
  planned: number;
  spent: number;
  remaining: number; // planned - spent in the current cycle (negative = over plan)
  closed: number; // opening + surplus of every finished cycle
  effective: number; // closed + remaining
  coveredFromSurplus: boolean; // over plan this cycle but the stored surplus absorbs it
  cyclesCounted: number;
};

export type Balance = {
  lines: LineBalance[];
  total: number;
  cycle: Cycle;
};

type Input = { today: string; settings: Settings; lines: Line[]; categories: Category[]; txs: Tx[] };

export function computeBalance({ today, settings, lines, categories, txs }: Input): Balance {
  const cycle = cycleFor(today, settings.cycle_day, settings.weekend_shift);
  const active = lines.filter((l) => l.active).sort((a, b) => a.sort - b.sort);

  const byLine = new Map<string, Tx[]>();
  for (const t of txs) {
    const id = lineIdOf(t, categories, lines);
    if (!id) continue;
    (byLine.get(id) ?? byLine.set(id, []).get(id)!).push(t);
  }
  const spentIn = (id: string, a: string, b: string) =>
    (byLine.get(id) ?? []).filter((t) => t.occurred_on >= a && t.occurred_on <= b).reduce((s, t) => s + net(t), 0);

  const out: LineBalance[] = active.map((line) => {
    const planned = plannedFor(line, cycle.start);
    const spent = spentIn(line.id, cycle.start, cycle.end);
    const remaining = planned - spent;
    const cycles = closedCycles(line.tracking_start, cycle, settings.cycle_day, settings.weekend_shift);
    const closed =
      line.opening_halalas +
      cycles.reduce((s, c) => s + plannedFor(line, c.start) - spentIn(line.id, c.start, c.end), 0);
    return {
      line, planned, spent, remaining, closed,
      effective: closed + remaining,
      coveredFromSurplus: remaining < 0 && closed + remaining >= 0,
      cyclesCounted: cycles.length,
    };
  });

  return { lines: out, total: out.reduce((s, l) => s + l.effective, 0), cycle };
}
