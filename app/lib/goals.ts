import { diffDays } from "./cycle";
import { addMonths } from "./installments";
import type { Goal, GoalContribution } from "./types";

export type GoalStatus = {
  goal: Goal;
  saved: number;
  remaining: number;
  pct: number; // 0..1
  done: boolean;
  /** Monthly pace used for the estimate, and where it came from. */
  rate: number | null;
  rateSource: "planned" | "history" | null;
  etaMonths: number | null;
  etaDate: string | null;
  /** Monthly amount needed to meet the deadline, if there is one. */
  neededMonthly: number | null;
  onTrack: boolean | null;
  /** "Add this much per month and you arrive sooner." */
  boost: { extra: number; months: number; saves: number } | null;
};

const roundUp50 = (halalas: number) => Math.ceil(halalas / 5000) * 5000;

export function goalStatus(goal: Goal, contributions: GoalContribution[], today: string): GoalStatus {
  const mine = contributions.filter((c) => c.goal_id === goal.id);
  const saved = Math.max(0, mine.reduce((s, c) => s + c.amount_halalas, 0));
  const remaining = Math.max(0, goal.target_halalas - saved);
  const pct = goal.target_halalas > 0 ? Math.min(1, saved / goal.target_halalas) : 0;
  const done = remaining === 0;

  // Pace: what the user planned, otherwise what they actually put in over the last 90 days (or since the
  // goal began, if that is shorter), never counting withdrawals as negative pace.
  let rate: number | null = null;
  let rateSource: GoalStatus["rateSource"] = null;
  if (goal.monthly_halalas && goal.monthly_halalas > 0) {
    rate = goal.monthly_halalas;
    rateSource = "planned";
  } else {
    const windowDays = Math.min(90, Math.max(30, diffDays(goal.created_on, today)));
    const recent = mine.filter((c) => c.amount_halalas > 0 && diffDays(c.on, today) <= windowDays && diffDays(c.on, today) >= 0);
    const total = recent.reduce((s, c) => s + c.amount_halalas, 0);
    if (total > 0) {
      rate = Math.round((total / windowDays) * 30);
      rateSource = "history";
    }
  }

  const etaMonths = done ? 0 : rate ? Math.ceil(remaining / rate) : null;
  const etaDate = etaMonths === null ? null : addMonths(today, etaMonths);

  let neededMonthly: number | null = null;
  let onTrack: boolean | null = null;
  if (goal.deadline && !done) {
    const monthsLeft = Math.max(1, Math.ceil(diffDays(today, goal.deadline) / 30.44));
    neededMonthly = diffDays(today, goal.deadline) <= 0 ? remaining : Math.ceil(remaining / monthsLeft);
    onTrack = rate !== null ? rate >= neededMonthly : null;
  }

  let boost: GoalStatus["boost"] = null;
  if (!done && rate && etaMonths && etaMonths > 1) {
    const extra = roundUp50(rate * 0.2);
    const months = Math.ceil(remaining / (rate + extra));
    if (months < etaMonths) boost = { extra, months, saves: etaMonths - months };
  }

  return { goal, saved, remaining, pct, done, rate, rateSource, etaMonths, etaDate, neededMonthly, onTrack, boost };
}
