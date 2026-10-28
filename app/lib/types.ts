export type Kind = "expense" | "refund";

export type Settings = {
  cycle_day: number;
  weekend_shift: boolean;
  salary_halalas: number;
  spending_budget_halalas: number | null;
  daily_allowance_halalas: number | null;
};

export type LineKind = "expenses" | "investment" | "emergency" | "custom";

/** A planned amount that applies from this cycle start onward, so past cycles keep the plan they had. */
export type Plan = { from: string; amount_halalas: number };

export type Line = {
  id: string;
  name: string;
  emoji: string;
  kind: LineKind;
  /** Spending from this line draws down the "can spend today" number. */
  counts_daily: boolean;
  plans: Plan[];
  opening_halalas: number;
  /** First cycle that counts toward the cumulative surplus. */
  tracking_start: string;
  sort: number;
  active: boolean;
};

export type Category = { id: string; name: string; emoji: string; sort: number; line_id: string | null };

export type Tx = {
  id: string;
  amount_halalas: number;
  kind: Kind;
  category_id: string | null;
  merchant: string | null;
  note: string | null;
  occurred_on: string;
  source: string;
};

export type Commitment = {
  id: string;
  name: string;
  emoji: string;
  amount_halalas: number;
  due_day: number;
  active: boolean;
};

export type Payment = {
  id: string;
  commitment_id: string;
  cycle_start: string;
  paid_on: string;
  amount_halalas: number;
};

export type Snapshot = {
  settings: Settings;
  categories: Category[];
  lines: Line[];
  txs: Tx[];
  commitments: Commitment[];
  payments: Payment[];
};

export const DEFAULT_SETTINGS: Settings = {
  cycle_day: 27,
  weekend_shift: true,
  salary_halalas: 0,
  spending_budget_halalas: null,
  daily_allowance_halalas: null,
};
