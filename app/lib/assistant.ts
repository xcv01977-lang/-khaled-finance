import { norm, stripAl, wordRe } from "./arabic";
import type { Balance } from "./balance";
import type { Summary } from "./budget";
import { addDays, cycleFor } from "./cycle";
import { fmt } from "./money";
import type { Category, Line, Settings, Tx } from "./types";

export type Ctx = {
  today: string;
  settings: Settings;
  categories: Category[];
  lines: Line[];
  txs: Tx[];
  summary: Summary;
  balance: Balance;
};

export const SUGGESTIONS = [
  "وش وضعي؟",
  "كم صرفت هالدورة؟",
  "وش أكثر شي يستهلك فلوسي؟",
  "أقدر أشتري شي بـ 800؟",
  "وش المدفوعات القادمة؟",
  "قارن بالدورة اللي فاتت",
];

const net = (t: Tx) => (t.kind === "refund" ? -t.amount_halalas : t.amount_halalas);
const sum = (ts: Tx[]) => ts.reduce((s, t) => s + net(t), 0);
// Whole riyals once the figure is 10 or more; small amounts keep their halalas.
const riyal = (h: number) => `${fmt(Math.abs(h) >= 1000 ? Math.round(h / 100) * 100 : h)} ر.س`;

type Period = { from: string; to: string; label: string };

function periodOf(q: string, ctx: Ctx): Period {
  const { today, settings } = ctx;
  const cur = cycleFor(today, settings.cycle_day, settings.weekend_shift);
  const prev = cycleFor(addDays(cur.start, -1), settings.cycle_day, settings.weekend_shift);
  if (wordRe("اول امس|قبل امس").test(q)) return { from: addDays(today, -2), to: addDays(today, -2), label: "أول أمس" };
  if (wordRe("امس").test(q)) return { from: addDays(today, -1), to: addDays(today, -1), label: "أمس" };
  if (wordRe("اليوم").test(q)) return { from: today, to: today, label: "اليوم" };
  if (/(الاسبوع|اسبوع)/.test(q) && /(فات|فاتت|الماضي|السابق|اللي قبل)/.test(q))
    return { from: addDays(today, -13), to: addDays(today, -7), label: "الأسبوع اللي فات" };
  if (/(هالاسبوع|هذا الاسبوع|هالاسبوع|الاسبوع|اسبوع)/.test(q)) return { from: addDays(today, -6), to: today, label: "آخر ٧ أيام" };
  if (/(الشهر|الدوره|دوره)/.test(q) && /(فات|فاتت|الماضي|السابق|اللي قبل|فايت)/.test(q))
    return { from: prev.start, to: prev.end, label: "الدورة اللي فاتت" };
  return { from: cur.start, to: cur.end, label: "هالدورة" };
}

const inPeriod = (t: Tx, p: Period) => t.occurred_on >= p.from && t.occurred_on <= p.to;

const SYNONYMS: Record<string, string[]> = {
  اكل: ["مطاعم", "بقاله"], طعام: ["مطاعم", "بقاله"], مطعم: ["مطاعم"], كوفي: ["قهوه"], كافيه: ["قهوه"], بترول: ["بنزين"],
  وقود: ["بنزين"], سيارة: ["بنزين", "مواصلات"], اوبر: ["مواصلات"], ملابس: ["تسوق"], دواء: ["صحه"], صيدليه: ["صحه"],
  نتفلكس: ["اشتراكات"], فواتير: ["فواتير"], سينما: ["ترفيه"],
};

/** Categories the question talks about, matched by name or a common synonym. */
function categoriesIn(q: string, cats: Category[]): Category[] {
  const ws = q.split(" ").map(stripAl);
  const hit = new Set<string>();
  for (const c of cats) if (ws.includes(stripAl(norm(c.name)))) hit.add(c.id);
  for (const w of ws) for (const name of SYNONYMS[w] ?? []) {
    const c = cats.find((x) => stripAl(norm(x.name)) === name);
    if (c) hit.add(c.id);
  }
  return cats.filter((c) => hit.has(c.id));
}

// Words are normalised (ى→ي, ة→ه) before they get here, so the stop list is written the same way.
const STOP = new Set(["كم", "صرفت", "دفعت", "علي", "في", "من", "هالدوره", "هالشهر", "الشهر", "الدوره", "اليوم", "امس", "وش", "اللي", "فات", "فاتت", "عند", "لدي", "الي"]);

/** A merchant name from the question, if some transaction's merchant contains one of its words. */
function merchantIn(q: string, txs: Tx[]): string | null {
  const ws = q.split(" ").map(stripAl).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d/.test(w));
  for (const w of ws) {
    const t = txs.find((x) => x.merchant && norm(x.merchant).includes(w));
    if (t?.merchant) return t.merchant;
  }
  return null;
}

const PERIOD_WORDS = new Set(["هالدوره", "هالشهر", "الشهر", "الدوره", "دوره", "اليوم", "امس", "اول", "الاسبوع", "اسبوع", "هالاسبوع", "هذا", "هذي", "كل", "الدورة", "فات", "فاتت", "الماضي", "السابق"]);

/** The thing the question asks about ("على X"), when it is a word that is neither a period nor a known name. */
function unknownTarget(q: string): string | null {
  const m = q.match(/(?:علي|في|عند|لدي|ع)\s+(\S+)/);
  if (!m) return null;
  const w = stripAl(m[1]);
  return w.length >= 2 && !PERIOD_WORDS.has(w) && !PERIOD_WORDS.has(m[1]) && !/^\d/.test(w) ? m[1] : null;
}

function amountIn(q: string): number | null {
  const m = q.match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const v = Math.round(parseFloat(m[1]) * 100);
  return v > 0 ? v : null;
}

// --------------------------------------------------------------------------------------------------

function spent(q: string, ctx: Ctx, raw: string): string {
  const period = periodOf(q, ctx);
  const all = ctx.txs.filter((t) => inPeriod(t, period));
  const cats = categoriesIn(q, ctx.categories);
  const merchant = cats.length === 0 ? merchantIn(q, ctx.txs) : null;
  const unknown = cats.length === 0 && !merchant ? unknownTarget(q) : null;
  if (unknown) {
    // Show the word the way the user typed it, not the matching form.
    const shown = raw.split(/\s+/).map((t) => t.replace(/[؟?!،,.]+$/g, "")).find((t) => norm(t) === unknown) ?? unknown;
    return `ما لقيت تصنيف أو محل باسم «${shown}». تصنيفاتك: ${ctx.categories.map((c) => c.name).join("، ")}.`;
  }

  let subset = all;
  let what = "";
  if (cats.length) {
    const ids = new Set(cats.map((c) => c.id));
    subset = all.filter((t) => t.category_id && ids.has(t.category_id));
    what = ` على ${cats.map((c) => c.name).join(" و")}`;
  } else if (merchant) {
    subset = all.filter((t) => t.merchant && norm(t.merchant).includes(norm(merchant).split(" ")[0]));
    what = ` عند ${merchant}`;
  }

  const total = sum(subset);
  if (subset.length === 0) return `ما سجّلت أي صرف${what} ${period.label}.`;
  const lines = [`صرفت ${riyal(total)}${what} ${period.label} (${subset.length} ${subset.length === 1 ? "عملية" : "عمليات"}).`];
  const whole = sum(all);
  if (what && whole > 0) lines.push(`وهذا ${Math.round((total / whole) * 100)}% من كل صرفك ${period.label} (${riyal(whole)}).`);

  // Same days of the previous cycle, so a half-finished cycle is not compared with a full one.
  if (period.label === "هالدورة") {
    const cur = cycleFor(ctx.today, ctx.settings.cycle_day, ctx.settings.weekend_shift);
    const prev = cycleFor(addDays(cur.start, -1), ctx.settings.cycle_day, ctx.settings.weekend_shift);
    const to = addDays(prev.start, cur.day - 1);
    const same = ctx.txs.filter((t) => t.occurred_on >= prev.start && t.occurred_on <= to);
    const filter = (ts: Tx[]) =>
      cats.length ? ts.filter((t) => cats.some((c) => c.id === t.category_id)) : ts;
    const before = sum(filter(same));
    if (before > 0) {
      const diff = total - before;
      lines.push(`بنفس الفترة من الدورة اللي فاتت كان ${riyal(before)}: ${diff === 0 ? "نفسه" : diff > 0 ? `أكثر بـ ${riyal(diff)}` : `أقل بـ ${riyal(-diff)}`}.`);
    }
  }
  return lines.join("\n");
}

function top(q: string, ctx: Ctx): string {
  const period = periodOf(q, ctx);
  const all = ctx.txs.filter((t) => inPeriod(t, period) && t.kind === "expense");
  if (all.length === 0) return `ما سجّلت صرف ${period.label}، ما عندي شي أحلله.`;
  const total = sum(all);
  const byCat = new Map<string, number>();
  for (const t of all) byCat.set(t.category_id ?? "", (byCat.get(t.category_id ?? "") ?? 0) + net(t));
  const ranked = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const name = (id: string) => ctx.categories.find((c) => c.id === id);
  const lines = [`أكثر شي يستهلك فلوسك ${period.label}:`];
  ranked.forEach(([id, v], i) => {
    const c = name(id);
    lines.push(`${i + 1}. ${c ? `${c.emoji} ${c.name}` : "📌 بدون تصنيف"}: ${riyal(v)} (${Math.round((v / total) * 100)}%)`);
  });
  const byMerchant = new Map<string, number>();
  for (const t of all) if (t.merchant) byMerchant.set(t.merchant, (byMerchant.get(t.merchant) ?? 0) + net(t));
  const best = [...byMerchant].sort((a, b) => b[1] - a[1])[0];
  if (best && byMerchant.size > 1) lines.push(`وأكثر محل: ${best[0]} بـ ${riyal(best[1])}.`);
  const uncategorised = byCat.get("") ?? 0;
  if (uncategorised / total > 0.3) lines.push(`ملاحظة: ${Math.round((uncategorised / total) * 100)}% من صرفك بدون تصنيف، فالترتيب فوق ما هو دقيق.`);
  return lines.join("\n");
}

function canBuy(q: string, ctx: Ctx): string {
  const price = amountIn(q);
  const { summary: s } = ctx;
  if (!price) return "كم سعرها؟ اكتب المبلغ وأقولك بصراحة.";
  if (s.pool <= 0) return "ما حددت راتبك أو بنود صرفك بعد، فما أقدر أحكم. حدّدها من الإعدادات وأرجع لك.";

  const remaining = s.pool - s.spent;
  const days = s.cycle.daysLeft;
  const after = remaining - price;
  const nowPerDay = days > 0 ? remaining / days : 0;
  const newPerDay = days > 0 ? after / days : 0;
  const lines: string[] = [];

  if (price <= s.allowedToday) {
    lines.push(`تقدر. تدخل في مخصص اليوم، ويبقى لك ${riyal(s.allowedToday - price)} بعدها.`);
  } else if (after >= 0 && newPerDay >= s.dailyBudget * 0.7) {
    lines.push(`تقدر، بس مخصصك اليومي ينزل من ${riyal(nowPerDay)} إلى ${riyal(newPerDay)} لين الراتب (بعد ${days} يوم).`);
  } else if (after >= 0) {
    lines.push(`تقدر على الورق، لكنها تضغطك: مخصصك اليومي يصير ${riyal(newPerDay)} بدل ${riyal(nowPerDay)} لين الراتب بعد ${days} يوم.`);
    lines.push("لو مو ضرورية، رأيي تأجلها.");
  } else {
    const over = -after;
    const surplus = ctx.balance.lines.filter((l) => l.line.counts_daily).reduce((sum2, l) => sum2 + Math.max(0, l.closed), 0);
    if (surplus >= over) {
      lines.push(`تتجاوز ميزانيتك هالدورة بـ ${riyal(over)}، لكن فائضك المتراكم ${riyal(surplus)} يغطيها.`);
      lines.push("يعني تقدر تدفعها، بس تحرق من فائضك. رأيي: إلا لو ضرورية، لا.");
    } else {
      lines.push(`لا. تتجاوز ميزانيتك بـ ${riyal(over)}${surplus > 0 ? `، وحتى فائضك المتراكم (${riyal(surplus)}) ما يكفي` : ""}.`);
      lines.push(`أقرب حل: انتظر الراتب بعد ${days} يوم، أو قسّمها وادفع جزء.`);
    }
  }
  if (s.commitmentsLeft > 0) lines.push(`وتذكر عليك التزامات باقية ${riyal(s.commitmentsLeft)} هالدورة.`);
  return lines.join("\n");
}

function status(ctx: Ctx): string {
  const { summary: s, balance: b } = ctx;
  if (s.pool <= 0) return "ما حددت راتبك أو بنود صرفك بعد. حدّدها من الإعدادات وأعطيك صورة كاملة.";
  const lines = [
    `تقدر تصرف اليوم ${s.allowedToday < 0 ? `ناقص ${riyal(-s.allowedToday)} (تعدّيت)` : riyal(s.allowedToday)}.`,
    `صرفت هالدورة ${riyal(s.spent)} من ${riyal(s.pool)}، وباقي ${s.cycle.daysLeft} يوم على الراتب.`,
    s.projectedSurplus >= 0
      ? `بهالمعدل تختم الدورة بفائض ${riyal(s.projectedSurplus)}.`
      : `بهالمعدل تختم الدورة بعجز ${riyal(-s.projectedSurplus)}. لازم تخفف.`,
  ];
  if (b.lines.length) lines.push(`ميزانك التراكمي ${b.total >= 0 ? "فائض" : "عجز"} ${riyal(Math.abs(b.total))}.`);
  if (s.commitmentsLeft > 0) lines.push(`وعليك التزامات باقية ${riyal(s.commitmentsLeft)}.`);
  return lines.join("\n");
}

function upcoming(ctx: Ctx): string {
  const open = ctx.summary.upcoming.filter((u) => u.status !== "paid");
  if (open.length === 0) return ctx.summary.upcoming.length ? "كل التزاماتك هالدورة مدفوعة. 👌" : "ما أضفت التزامات بعد.";
  const lines = [`عليك ${riyal(ctx.summary.commitmentsLeft)} هالدورة:`];
  for (const u of open) {
    const when = u.status === "overdue" ? `متأخرة ${-u.inDays} يوم ⚠️` : u.status === "today" ? "اليوم" : `بعد ${u.inDays} يوم`;
    lines.push(`• ${u.commitment.emoji} ${u.commitment.name}: ${riyal(u.commitment.amount_halalas)} (${when})`);
  }
  return lines.join("\n");
}

function compare(ctx: Ctx): string {
  const { today, settings, txs } = ctx;
  const cur = cycleFor(today, settings.cycle_day, settings.weekend_shift);
  const prev = cycleFor(addDays(cur.start, -1), settings.cycle_day, settings.weekend_shift);
  const upTo = addDays(prev.start, cur.day - 1);
  const now = sum(txs.filter((t) => t.occurred_on >= cur.start && t.occurred_on <= cur.end));
  const before = sum(txs.filter((t) => t.occurred_on >= prev.start && t.occurred_on <= upTo));
  const full = sum(txs.filter((t) => t.occurred_on >= prev.start && t.occurred_on <= prev.end));
  if (before === 0 && full === 0) return "ما عندي صرف للدورة اللي فاتت أقارن فيه.";
  const diff = now - before;
  const lines = [
    `لين اليوم ${cur.day} من الدورة صرفت ${riyal(now)}، وبنفس الفترة قبلها ${riyal(before)}.`,
    diff === 0 ? "نفس المستوى." : diff > 0 ? `يعني أكثر بـ ${riyal(diff)} (${before ? Math.round((diff / before) * 100) : 100}%).` : `يعني أقل بـ ${riyal(-diff)}، ممتاز.`,
    `الدورة اللي فاتت كلها كانت ${riyal(full)}.`,
  ];
  return lines.join("\n");
}

function daily(ctx: Ctx): string {
  const s = ctx.summary;
  if (s.pool <= 0) return "حدّد راتبك أو بنود صرفك من الإعدادات أول.";
  return `مخصصك اليومي ${riyal(s.dailyBudget)}. وبعد اللي صرفته لين الحين، تقدر تصرف ${s.allowedToday < 0 ? `ناقص ${riyal(-s.allowedToday)}` : riyal(s.allowedToday)} اليوم.`;
}

const HELP = `ما فهمت سؤالك. جرّب مثل:\n• كم صرفت على المطاعم هالدورة؟\n• وش أكثر شي يستهلك فلوسي؟\n• أقدر أشتري شي بـ 800؟\n• وش وضعي؟`;

/** Answer from the user's own numbers. Every figure here is computed, none is guessed. */
export function answer(question: string, ctx: Ctx): string {
  const q = norm(question);
  if (!q) return HELP;
  const hasAmount = amountIn(q) !== null;

  if (/(اقدر|ينفع|يصلح|هل اشتري|ابي اشتري|ابغى اشتري|اشتري|اخذ|آخذ|ادفع)/.test(q) && (hasAmount || /اشتري|اخذ/.test(q)) && !/كم (صرفت|دفعت)/.test(q)) return canBuy(q, ctx);
  if (/(قارن|مقارنه|مقارنة)/.test(q)) return compare(ctx);
  if (/(اكثر|اعلي|يستهلك|ياكل|وين (تروح|راحت|تروح)|اغلي)/.test(q)) return top(q, ctx);
  if (/(المدفوعات|الالتزامات|الاقساط|القادمه|القادمة|كم علي|وش علي|عليني|تابي|تمارا)/.test(q)) return upcoming(ctx);
  if (/(كم (صرفت|دفعت|انفقت|طلعت)|صرفت|صرفي|مصروفي|دفعت)/.test(q)) return spent(q, ctx, question);
  if (/(كم اقدر اصرف|اصرف اليوم|مخصص|يومي|يوميا)/.test(q)) return daily(ctx);
  if (/(وضعي|كم باقي|باقي كم|فايض|عجز|ميزاني|الميزان|كيف حالي|كيف وضعي|وش الاخبار)/.test(q)) return status(ctx);
  return HELP;
}

