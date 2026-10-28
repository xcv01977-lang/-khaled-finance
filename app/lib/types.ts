export type Kind = "expense" | "refund";

export type Settings = {
  cycle_day: number;
  weekend_shift: boolean;
  salary_halalas: number;
  spending_budget_halalas: number | null;
  daily_allowance_halalas: number | null;
};

export type Category = { id: string; name: string; emoji: string; sort: number };

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
