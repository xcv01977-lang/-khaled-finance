import { addDays, cycleFor, todayRiyadh } from "./cycle";
import { DEFAULT_SETTINGS, type Category, type Snapshot } from "./types";
import { DEFAULT_CATEGORIES, type Repo } from "./repo";

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
  return { settings, categories, lines: [], txs, commitments, payments: [] };
}

function read(today: string): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Snapshot;
      s.lines ??= []; // data saved by an earlier version of the demo
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
};
