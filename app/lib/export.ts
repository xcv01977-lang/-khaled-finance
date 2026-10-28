import type {
  Category, Commitment, Goal, GoalContribution, InstallmentPayment, InstallmentPlan, Line, Payment, Rule, Settings, Snapshot, Tx,
} from "./types";

export const EXPORT_FORMAT = "mizan-export";
export const EXPORT_VERSION = 1;

/** Everything the user entered. The inbox log and the Shortcut key are left out on purpose. */
export type ExportData = {
  settings: Omit<Settings, "ingest_token_hash">;
  categories: Category[];
  lines: Line[];
  txs: Tx[];
  commitments: Commitment[];
  payments: Payment[];
  plans: InstallmentPlan[];
  planPayments: InstallmentPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  rules: Rule[];
};

export type ExportFile = { format: typeof EXPORT_FORMAT; version: number; exported_at: string; data: ExportData };

export function buildExport(snap: Snapshot, now: Date = new Date()): ExportFile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ingest_token_hash, ...settings } = snap.settings;
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: now.toISOString(),
    data: {
      settings, categories: snap.categories, lines: snap.lines, txs: snap.txs, commitments: snap.commitments,
      payments: snap.payments, plans: snap.plans, planPayments: snap.planPayments, goals: snap.goals,
      contributions: snap.contributions, rules: snap.rules,
    },
  };
}

export const exportCounts = (d: ExportData) => ({
  transactions: d.txs.length, categories: d.categories.length, lines: d.lines.length, commitments: d.commitments.length,
  plans: d.plans.length, goals: d.goals.length,
});

// ---- validation: a damaged or foreign file must be refused before anything is written -------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" && v.length > 0;
const int = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const posInt = (v: unknown) => int(v) && (v as number) > 0;
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const nullable = (f: (v: unknown) => boolean) => (v: unknown) => v === null || v === undefined || f(v);

const SHAPES: Record<string, Record<string, (v: unknown) => boolean>> = {
  categories: { id: str, name: str, sort: int },
  lines: { id: str, name: str, kind: (v) => ["expenses", "investment", "emergency", "custom"].includes(v as string), plans: Array.isArray, opening_halalas: int, tracking_start: date },
  txs: { id: str, amount_halalas: posInt, kind: (v) => v === "expense" || v === "refund", occurred_on: date },
  commitments: { id: str, name: str, amount_halalas: posInt, due_day: (v) => int(v) && (v as number) >= 1 && (v as number) <= 31 },
  payments: { id: str, commitment_id: str, cycle_start: date, paid_on: date, amount_halalas: posInt },
  plans: { id: str, name: str, installment_halalas: posInt, total_count: posInt, first_due: date, period: (v) => ["monthly", "biweekly", "weekly"].includes(v as string) },
  planPayments: { id: str, plan_id: str, number: posInt, paid_on: date, amount_halalas: posInt },
  goals: { id: str, name: str, target_halalas: posInt, deadline: nullable(date), created_on: date },
  contributions: { id: str, goal_id: str, amount_halalas: (v) => int(v) && v !== 0, on: date },
  rules: { id: str, merchant_key: str },
};

export type ParseResult = { ok: true; data: ExportData; counts: ReturnType<typeof exportCounts>; exportedAt: string } | { ok: false; error: string };

export function parseExport(raw: string): ParseResult {
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return { ok: false, error: "الملف مو JSON صحيح." }; }
  if (!isObj(j) || j.format !== EXPORT_FORMAT) return { ok: false, error: "هذا مو ملف نسخة من «ميزان»." };
  if (typeof j.version !== "number" || j.version > EXPORT_VERSION) return { ok: false, error: "النسخة من إصدار أحدث من هذا التطبيق." };
  if (!isObj(j.data)) return { ok: false, error: "الملف ناقص: ما فيه بيانات." };

  const d = j.data;
  const out: Obj = {};
  for (const [key, shape] of Object.entries(SHAPES)) {
    const rows = d[key] ?? [];
    if (!Array.isArray(rows)) return { ok: false, error: `الجزء «${key}» في الملف تالف.` };
    for (const [i, row] of rows.entries()) {
      if (!isObj(row)) return { ok: false, error: `الصف ${i + 1} في «${key}» تالف.` };
      for (const [field, ok] of Object.entries(shape)) {
        if (!ok(row[field])) return { ok: false, error: `الصف ${i + 1} في «${key}»: الحقل «${field}» غير صحيح.` };
      }
    }
    out[key] = rows;
  }
  const s = d.settings;
  if (!isObj(s) || !int(s.cycle_day) || !int(s.salary_halalas)) return { ok: false, error: "إعدادات الدورة في الملف غير صحيحة." };
  out.settings = {
    cycle_day: s.cycle_day, weekend_shift: s.weekend_shift !== false, salary_halalas: s.salary_halalas,
    spending_budget_halalas: int(s.spending_budget_halalas) ? s.spending_budget_halalas : null,
    daily_allowance_halalas: int(s.daily_allowance_halalas) ? s.daily_allowance_halalas : null,
  };
  const data = out as unknown as ExportData;
  return { ok: true, data, counts: exportCounts(data), exportedAt: String(j.exported_at ?? "") };
}
