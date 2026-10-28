export type Kind = "expense" | "refund";

export type Settings = {
  cycle_day: number;
  weekend_shift: boolean;
  salary_halalas: number;
  spending_budget_halalas: number | null;
  daily_allowance_halalas: number | null;
  /** SHA-256 of the secret the iPhone Shortcut sends. The secret itself is never stored. */
  ingest_token_hash: string | null;
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

export type InstallmentPeriod = "monthly" | "biweekly" | "weekly";

/** A Tabby/Tamara (or any) payment plan: `total_count` equal payments starting on `first_due`. */
export type InstallmentPlan = {
  id: string;
  name: string;
  provider: "tabby" | "tamara" | "other";
  installment_halalas: number;
  total_count: number;
  first_due: string;
  period: InstallmentPeriod;
  active: boolean;
};

export type InstallmentPayment = { id: string; plan_id: string; number: number; paid_on: string; amount_halalas: number };

export type Goal = {
  id: string;
  name: string;
  emoji: string;
  target_halalas: number;
  /** Optional planned monthly saving; otherwise the pace is read from past contributions. */
  monthly_halalas: number | null;
  deadline: string | null;
  created_on: string;
};

/** Money put into (positive) or taken out of (negative) a goal. */
export type GoalContribution = { id: string; goal_id: string; amount_halalas: number; on: string };

export type Snapshot = {
  settings: Settings;
  categories: Category[];
  lines: Line[];
  txs: Tx[];
  commitments: Commitment[];
  payments: Payment[];
  inbox: InboxItem[];
  rules: Rule[];
  plans: InstallmentPlan[];
  planPayments: InstallmentPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
};

export type InboxStatus = "auto" | "review" | "done" | "ignored" | "duplicate" | "unparsed";

export type InboxItem = {
  id: string;
  raw_text: string;
  bank: string | null;
  direction: string;
  amount_halalas: number | null;
  merchant: string | null;
  merchant_key: string;
  card_last4: string | null;
  occurred_on: string | null;
  status: InboxStatus;
  transaction_id: string | null;
  created_at: string;
};

/** What the user taught the app about a merchant: always this category, or always ignore. */
export type Rule = { id: string; merchant_key: string; category_id: string | null; ignore: boolean; hits: number };

export const DEFAULT_SETTINGS: Settings = {
  cycle_day: 27,
  weekend_shift: true,
  salary_halalas: 0,
  spending_budget_halalas: null,
  daily_allowance_halalas: null,
  ingest_token_hash: null,
};
