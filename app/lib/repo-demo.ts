import { addDays, cycleFor, todayRiyadh } from "./cycle";
import { DEFAULT_SETTINGS, type Category, type Snapshot } from "./types";
import { DEFAULT_CATEGORIES, type Repo } from "./repo";
import { planIngest } from "./sms/ingest";

const KEY = "khaled-finance-demo";
const uuid = () => crypto.randomUUID();

function seed(today: string): Snapshot {
  const categories: Category[] = DEFAULT_CATEGORIES.map(([name, emoji], i) => ({ id: uuid(), name, emoji, sort: i, line_id: null }));
  const cat = (n: string) => categories.find((c) => c.name === n)!.id;
  const settings = { ...DEFAULT_SETTINGS, salary_halalas: 1_000_000 };
  const cycle = cycleFor(today, settings.cycle_day, settings.weekend_shift);
  const mk = (back: number, riyals: number, c: string, merchant: string) => ({
    id: uuid(), amount_halalas: riyals * 100, kind: "expense" as const, category_id: cat(c),
    merchant, note: null, occurred_on: addDays(today, -back), source: "manual",
  });
  const txs = [
    mk(0, 18, "قهوة", "قهوة"), mk(0, 34, "مطاعم", "غداء"), mk(1, 90, "بنزين", "بنزين"),
    mk(2, 212, "بقالة", "بقالة الأسبوع"), mk(3, 64, "مطاعم", "عشاء"), mk(5, 150, "تسوق", "ملابس"),
  ].filter((t) => t.occurred_on >= cycle.start);
  const commitments = [
    { id: uuid(), name: "الإيجار", emoji: "🏠", amount_halalas: 320_000, due_day: 1, active: true },
    { id: uuid(), name: "تابي", emoji: "🛍️", amount_halalas: 45_000, due_day: 5, active: true },
    { id: uuid(), name: "نتفليكس", emoji: "🎬", amount_halalas: 4_500, due_day: 8, active: true },
  ];
  return { settings, categories, lines: [], txs, commitments, payments: [], inbox: [], rules: [], plans: [], planPayments: [], goals: [], contributions: [] };
}

function read(today: string): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Snapshot;
      s.lines ??= []; // data saved by an earlier version of the demo
      s.inbox ??= [];
      s.rules ??= [];
      s.plans ??= [];
      s.planPayments ??= [];
      s.goals ??= [];
      s.contributions ??= [];
      s.settings.ingest_token_hash ??= null;
      s.categories = s.categories.map((c) => ({ ...c, line_id: c.line_id ?? null }));
      return s;
    }
  } catch {}
  const s = seed(today || todayRiyadh());
  write(s);
  return s;
}
function write(s: Snapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export const demoRepo: Repo = {
  async load(today) { return read(today); },
  async saveSettings(settings) { const s = read(""); s.settings = settings; write(s); return settings; },
  async saveTx(t) {
    const s = read("");
    // Spread first: callers pass `id: undefined` for new rows and it must not overwrite the generated id.
    const row = { source: "manual", ...t, id: t.id ?? uuid() } as Snapshot["txs"][number];
    s.txs = [row, ...s.txs.filter((x) => x.id !== row.id)];
    write(s); return row;
  },
  async deleteTx(id) { const s = read(""); s.txs = s.txs.filter((x) => x.id !== id); write(s); },
  async saveCommitment(c) {
    const s = read("");
    const row = { ...c, id: c.id ?? uuid() };
    s.commitments = [...s.commitments.filter((x) => x.id !== row.id), row];
    write(s); return row;
  },
  async deleteCommitment(id) { const s = read(""); s.commitments = s.commitments.filter((x) => x.id !== id); write(s); },
  async pay(p) { const s = read(""); const row = { ...p, id: uuid() }; s.payments = [...s.payments, row]; write(s); return row; },
  async unpay(id) { const s = read(""); s.payments = s.payments.filter((x) => x.id !== id); write(s); },
  async saveLine(l) {
    const s = read("");
    const row = { ...l, id: l.id ?? uuid() };
    s.lines = [...s.lines.filter((x) => x.id !== row.id), row].sort((a, b) => a.sort - b.sort);
    write(s); return row;
  },
  async deleteLine(id) {
    const s = read("");
    s.lines = s.lines.filter((x) => x.id !== id);
    s.categories = s.categories.map((c) => (c.line_id === id ? { ...c, line_id: null } : c));
    write(s);
  },
  async saveCategory(c) {
    const s = read("");
    const row = { ...c, id: c.id ?? uuid() };
    s.categories = [...s.categories.filter((x) => x.id !== row.id), row].sort((a, b) => a.sort - b.sort);
    write(s); return row;
  },
  async deleteCategory(id) {
    const s = read("");
    s.categories = s.categories.filter((x) => x.id !== id);
    s.txs = s.txs.map((t) => (t.category_id === id ? { ...t, category_id: null } : t));
    write(s);
  },

  async savePlan(p) {
    const s = read("");
    const row = { ...p, id: p.id ?? uuid() };
    s.plans = [...s.plans.filter((x) => x.id !== row.id), row].sort((a, b) => a.first_due.localeCompare(b.first_due));
    write(s); return row;
  },
  async deletePlan(id) {
    const s = read("");
    s.plans = s.plans.filter((x) => x.id !== id);
    s.planPayments = s.planPayments.filter((x) => x.plan_id !== id);
    write(s);
  },
  async payInstallment(p) {
    const s = read("");
    if (s.planPayments.some((x) => x.plan_id === p.plan_id && x.number === p.number)) throw new Error("هذي الدفعة مسجلة مدفوعة");
    const row = { ...p, id: uuid() };
    s.planPayments = [...s.planPayments, row];
    write(s); return row;
  },
  async unpayInstallment(id) { const s = read(""); s.planPayments = s.planPayments.filter((x) => x.id !== id); write(s); },
  async saveGoal(g) {
    const s = read("");
    const row = { ...g, id: g.id ?? uuid() };
    s.goals = [...s.goals.filter((x) => x.id !== row.id), row];
    write(s); return row;
  },
  async deleteGoal(id) {
    const s = read("");
    s.goals = s.goals.filter((x) => x.id !== id);
    s.contributions = s.contributions.filter((x) => x.goal_id !== id);
    write(s);
  },
  async addContribution(c) { const s = read(""); const row = { ...c, id: uuid() }; s.contributions = [row, ...s.contributions]; write(s); return row; },
  async deleteContribution(id) { const s = read(""); s.contributions = s.contributions.filter((x) => x.id !== id); write(s); },
  async ingest(raw, p) {
    const s = read("");
    const hash = fnv(raw);
    const recent = Date.now() - 10 * 60_000;
    const dup = s.inbox.some((i) => (i as Hashed)._h === hash && i.status !== "duplicate" && Date.parse(i.created_at) > recent);
    const plan = planIngest(p, { rules: s.rules, categories: s.categories, isDuplicate: dup });
    let transaction_id: string | null = null;
    if (plan.tx) {
      transaction_id = uuid();
      s.txs = [{ id: transaction_id, note: null, source: "sms", occurred_on: p.occurred_on ?? todayRiyadh(), ...plan.tx }, ...s.txs];
    }
    if (plan.ruleHit) s.rules = s.rules.map((r) => (r.id === plan.ruleHit ? { ...r, hits: r.hits + 1 } : r));
    const item: Hashed = {
      id: uuid(), raw_text: raw, bank: p.bank, direction: p.direction, amount_halalas: p.amount_halalas,
      merchant: p.merchant, merchant_key: p.merchant_key, card_last4: p.card_last4, occurred_on: p.occurred_on ?? todayRiyadh(),
      status: plan.status, transaction_id, created_at: new Date().toISOString(), _h: hash,
    };
    s.inbox = [item, ...s.inbox].slice(0, 100);
    write(s);
    return { status: plan.status };
  },
  async saveRule(key, categoryId) {
    const s = read("");
    s.rules = upsertRule(s.rules, key, { category_id: categoryId, ignore: false });
    write(s);
  },
  async importData(d) {
    const s = read("");
    const merge = <T extends { id: string }>(have: T[], add: T[]) => [...have.filter((h) => !add.some((a) => a.id === h.id)), ...add];
    s.settings = { ...s.settings, ...d.settings };
    s.lines = merge(s.lines, d.lines);
    s.categories = merge(s.categories, d.categories);
    s.rules = merge(s.rules, d.rules);
    s.txs = merge(s.txs, d.txs);
    s.commitments = merge(s.commitments, d.commitments);
    s.payments = merge(s.payments, d.payments);
    s.plans = merge(s.plans, d.plans);
    s.planPayments = merge(s.planPayments, d.planPayments);
    s.goals = merge(s.goals, d.goals);
    s.contributions = merge(s.contributions, d.contributions);
    write(s);
  },
  async resolveInbox(item) {
    const s = read("");
    s.inbox = s.inbox.map((i) => (i.id === item.id ? { ...i, status: "done" } : i));
    write(s);
  },
  async classifyInbox(item, categoryId) {
    const s = read("");
    s.txs = s.txs.map((t) => (t.id === item.transaction_id ? { ...t, category_id: categoryId } : t));
    if (item.merchant_key) s.rules = upsertRule(s.rules, item.merchant_key, { category_id: categoryId, ignore: false });
    s.inbox = s.inbox.map((i) => (i.id === item.id ? { ...i, status: "done" } : i));
    write(s);
  },
  async ignoreInbox(item) {
    const s = read("");
    s.txs = s.txs.filter((t) => t.id !== item.transaction_id);
    if (item.merchant_key) s.rules = upsertRule(s.rules, item.merchant_key, { category_id: null, ignore: true });
    s.inbox = s.inbox.map((i) => (i.id === item.id ? { ...i, status: "ignored", transaction_id: null } : i));
    write(s);
  },
  async recordInbox(item, categoryId) {
    if (!item.amount_halalas) throw new Error("الرسالة ما فيها مبلغ مقروء، سجّلها يدوياً");
    const s = read("");
    const id = uuid();
    s.txs = [{
      id, amount_halalas: item.amount_halalas, kind: item.direction === "refund" ? "refund" : "expense", category_id: categoryId,
      merchant: item.merchant, note: null, occurred_on: item.occurred_on ?? todayRiyadh(), source: "sms",
    }, ...s.txs];
    s.inbox = s.inbox.map((i) => (i.id === item.id ? { ...i, status: "done", transaction_id: id } : i));
    write(s);
  },
};

type Hashed = Snapshot["inbox"][number] & { _h?: string };

/** Small stable hash for duplicate detection in the demo; production hashes with SHA-256 in the database. */
function fnv(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

function upsertRule(rules: Snapshot["rules"], key: string, patch: { category_id: string | null; ignore: boolean }): Snapshot["rules"] {
  const found = rules.find((r) => r.merchant_key === key);
  if (found) return rules.map((r) => (r === found ? { ...r, ...patch } : r));
  return [...rules, { id: uuid(), merchant_key: key, hits: 0, ...patch }];
}
