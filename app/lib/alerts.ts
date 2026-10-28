import type { Balance } from "./balance";
import type { Summary } from "./budget";
import { addDays, diffDays } from "./cycle";
import { fmt } from "./money";
import { detectRecurring } from "./recurring";
import { merchantKey } from "./sms/normalize";
import type { Category, Settings, Tx } from "./types";

export type AlertTone = "bad" | "warn" | "info";

export type SmartAlert = {
  /** Stable across days, so a dismissed alert stays dismissed. */
  id: string;
  tone: AlertTone;
  text: string;
  /** Overdue payments cannot be waved away. */
  dismissible: boolean;
  action?: "recurring" | "balance" | "week" | "list";
};

export type AlertCtx = {
  today: string;
  settings: Settings;
  categories: Category[];
  txs: Tx[];
  summary: Summary;
  balance: Balance;
};

const net = (t: Tx) => (t.kind === "refund" ? -t.amount_halalas : t.amount_halalas);
const sum = (ts: Tx[]) => ts.reduce((s, t) => s + net(t), 0);
const riyal = (h: number) => `${fmt(Math.abs(h) >= 1000 ? Math.round(h / 100) * 100 : h)} ر.س`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const ORDER: Record<AlertTone, number> = { bad: 0, warn: 1, info: 2 };
const UNUSUAL_FACTOR = 3;
const UNUSUAL_MIN = 15_000; // 150 SAR: below this nothing is "unusual" however it compares
const HISTORY_DAYS = 120;

function unusual(ctx: AlertCtx): SmartAlert[] {
  const out: SmartAlert[] = [];
  const recent = ctx.txs.filter((t) => t.kind === "expense" && diffDays(t.occurred_on, ctx.today) >= 0 && diffDays(t.occurred_on, ctx.today) <= 2);
  for (const t of recent) {
    if (!t.category_id) continue;
    const history = ctx.txs.filter(
      (x) => x.id !== t.id && x.kind === "expense" && x.category_id === t.category_id &&
        x.occurred_on < t.occurred_on && diffDays(x.occurred_on, t.occurred_on) <= HISTORY_DAYS,
    );
    if (history.length < 5) continue;
    const typical = median(history.map((x) => x.amount_halalas));
    if (t.amount_halalas > Math.max(typical * UNUSUAL_FACTOR, UNUSUAL_MIN)) {
      const cat = ctx.categories.find((c) => c.id === t.category_id);
      out.push({
        id: `odd:${t.id}`, tone: "warn", dismissible: true, action: "list",
        text: `عملية غير معتادة: ${riyal(t.amount_halalas)}${t.merchant ? ` عند ${t.merchant}` : ""} في ${cat?.name ?? "تصنيف"}، وعادةً حوالي ${riyal(typical)}.`,
      });
    }
  }
  return out;
}

function duplicates(ctx: AlertCtx): SmartAlert[] {
  const seen = new Map<string, Tx[]>();
  for (const t of ctx.txs) {
    if (t.kind !== "expense" || diffDays(t.occurred_on, ctx.today) > 3 || diffDays(t.occurred_on, ctx.today) < 0) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const k = `${t.occurred_on}|${t.amount_halalas}|${key}`;
    seen.set(k, [...(seen.get(k) ?? []), t]);
  }
  return [...seen].filter(([, v]) => v.length > 1).map(([k, v]) => ({
    id: `dup:${k}`, tone: "warn" as const, dismissible: true, action: "list" as const,
    text: `عملية مكررة؟ ${riyal(v[0].amount_halalas)} عند ${v[0].merchant} سُجّلت ${v.length} مرات بنفس اليوم.`,
  }));
}

function limits(ctx: AlertCtx): SmartAlert[] {
  const out: SmartAlert[] = [];
  const start = ctx.balance.cycle.start;
  for (const b of ctx.balance.lines) {
    if (b.planned <= 0) continue;
    const pct = b.spent / b.planned;
    if (pct >= 1) {
      out.push({
        id: `line:${b.line.id}:${start}:over`, tone: "bad", dismissible: true, action: "balance",
        text: `${b.line.emoji} تعدّيت بند ${b.line.name}: صرفت ${riyal(b.spent)} من ${riyal(b.planned)}${b.coveredFromSurplus ? ". تغطّى من فائضك المتراكم." : "."}`,
      });
    } else if (pct >= 0.8) {
      out.push({
        id: `line:${b.line.id}:${start}:80`, tone: "warn", dismissible: true, action: "balance",
        text: `${b.line.emoji} اقتربت من حد بند ${b.line.name}: صرفت ${Math.round(pct * 100)}% وباقي ${riyal(b.remaining)}.`,
      });
    }
  }
  // Without budget lines the same warning applies to the whole spending budget.
  if (ctx.balance.lines.length === 0 && ctx.summary.pool > 0) {
    const pct = ctx.summary.spent / ctx.summary.pool;
    if (pct >= 1) out.push({ id: `pool:${start}:over`, tone: "bad", dismissible: true, text: `تعدّيت ميزانية المصروف: ${riyal(ctx.summary.spent)} من ${riyal(ctx.summary.pool)}.` });
    else if (pct >= 0.8) out.push({ id: `pool:${start}:80`, tone: "warn", dismissible: true, text: `اقتربت من نهاية ميزانية المصروف: ${Math.round(pct * 100)}% وباقي ${ctx.summary.cycle.daysLeft} يوم.` });
  }
  return out;
}

function recurring(ctx: AlertCtx): SmartAlert[] {
  const out: SmartAlert[] = [];
  for (const r of detectRecurring(ctx.txs, ctx.today)) {
    if (r.status === "rose") {
      out.push({
        id: `rise:${r.key}:${r.lastDate}`, tone: "warn", dismissible: true, action: "recurring",
        text: `${r.name} ارتفع من ${riyal(r.previous!)} إلى ${riyal(r.last)} (+${r.risePct}%).`,
      });
    } else if (r.status === "missing") {
      out.push({
        id: `miss:${r.key}:${r.nextExpected}`, tone: "info", dismissible: true, action: "recurring",
        text: `${r.name} ما انسحب هالمرة، وكان ${r.period === "monthly" ? "كل شهر" : "كل أسبوع"} (آخر مرة ${r.lastDate}). ألغيته؟`,
      });
    }
  }
  return out;
}

/** Thursday and Friday: the week is done, offer the short summary. */
function weekly(ctx: AlertCtx): SmartAlert[] {
  const wd = new Date(Date.UTC(+ctx.today.slice(0, 4), +ctx.today.slice(5, 7) - 1, +ctx.today.slice(8, 10))).getUTCDay();
  if (wd !== 4 && wd !== 5) return [];
  const thursday = wd === 4 ? ctx.today : addDays(ctx.today, -1);
  return [{ id: `week:${thursday}`, tone: "info", dismissible: true, action: "week", text: "ملخص أسبوعك جاهز." }];
}

/** Everything worth a card, most urgent first. */
export function buildAlerts(ctx: AlertCtx): SmartAlert[] {
  const fromSummary: SmartAlert[] = ctx.summary.alerts.map((a) => ({
    id: `${a.id}:${ctx.balance.cycle.start}`, tone: a.id === "overdue" ? "bad" : "warn",
    text: a.text, dismissible: a.id !== "overdue",
  }));
  return [...fromSummary, ...limits(ctx), ...unusual(ctx), ...duplicates(ctx), ...recurring(ctx), ...weekly(ctx)]
    .sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

/** Short text summary of the last 7 days against the 7 before. */
export function weeklySummary(ctx: AlertCtx): string[] {
  const { today, txs, categories, summary } = ctx;
  const inRange = (from: number, to: number) =>
    txs.filter((t) => diffDays(t.occurred_on, today) >= from && diffDays(t.occurred_on, today) <= to);
  const thisWeek = inRange(0, 6);
  const lastWeek = inRange(7, 13);
  const total = sum(thisWeek);
  const before = sum(lastWeek);
  const lines: string[] = [];
  if (thisWeek.length === 0) return ["ما سجّلت صرف آخر ٧ أيام."];

  lines.push(`صرفت ${riyal(total)} آخر ٧ أيام (${thisWeek.length} عملية).`);
  if (before > 0) {
    const d = total - before;
    lines.push(d === 0 ? "نفس الأسبوع اللي قبله." : d > 0 ? `أكثر من الأسبوع اللي قبله بـ ${riyal(d)}.` : `أقل من الأسبوع اللي قبله بـ ${riyal(-d)}.`);
  }
  const byCat = new Map<string, number>();
  for (const t of thisWeek.filter((x) => x.kind === "expense")) byCat.set(t.category_id ?? "", (byCat.get(t.category_id ?? "") ?? 0) + t.amount_halalas);
  const top = [...byCat].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const c = categories.find((x) => x.id === top[0]);
    lines.push(`أكثر شي: ${c ? `${c.emoji} ${c.name}` : "بدون تصنيف"} بـ ${riyal(top[1])}.`);
  }
  if (summary.pool > 0) {
    lines.push(summary.projectedSurplus >= 0
      ? `الدورة ماشية زين: متوقع تختمها بفائض ${riyal(summary.projectedSurplus)}.`
      : `انتبه: بهالمعدل تختم الدورة بعجز ${riyal(-summary.projectedSurplus)}.`);
  }
  return lines;
}
