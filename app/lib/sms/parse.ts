import { categoryHint } from "./hints";
import { merchantKey, normalizeText } from "./normalize";

export type Direction =
  | "purchase" | "withdrawal" | "refund" | "deposit" | "transfer_in" | "transfer_out" | "installment" | "unknown";

export type Parsed = {
  bank: string | null;
  direction: Direction;
  amount_halalas: number | null;
  merchant: string | null;
  merchant_key: string;
  card_last4: string | null;
  occurred_on: string | null; // YYYY-MM-DD, null when the message carries no usable date
  category_hint: string | null;
};

const BANKS: [RegExp, string][] = [
  [/الراجحي|al ?rajhi|rajhi/i, "الراجحي"],
  [/الأهلي|الاهلي|\bsnb\b|alahli|al ?ahli/i, "الأهلي"],
  [/الإنماء|الانماء|إنماء|انماء|alinma|inma/i, "الإنماء"],
  [/stc ?bank|اس تي سي بنك|stc ?pay/i, "STC Bank"],
  [/d360|دي ?360/i, "D360"],
  [/تابي|tabby/i, "تابي"],
  [/تمارا|tamara/i, "تمارا"],
  [/الجزيرة|aljazira/i, "الجزيرة"],
  [/ساب|\bsab\b|sabb/i, "ساب"],
  [/الرياض|riyad ?bank|riyadbank/i, "بنك الرياض"],
  [/البلاد|albilad/i, "البلاد"],
  [/بنك الفرنسي|alfransi|saudi fransi/i, "الفرنسي"],
];

// Order matters: specific phrases before generic ones ("حوالة صادرة" before "حوالة").
const DIRECTIONS: [RegExp, Direction][] = [
  [/استرجاع|استرداد|مرتجع|refund|reversal|returned|إلغاء عملية|الغاء عملية/i, "refund"],
  [/دفعة\s*\d+\s*من\s*\d+|قسط|installment|تقسيط|تحصيل الدفعة|instalment/i, "installment"],
  [/حوالة واردة|تحويل وارد|incoming transfer|received from|تم استلام/i, "transfer_in"],
  [/إيداع|ايداع|راتب|deposit|credited|تم إضافة|تم اضافة|salary/i, "deposit"],
  [/حوالة صادرة|تحويل صادر|حوالة|تحويل|transfer|sadad|سداد/i, "transfer_out"],
  [/سحب|صراف|\batm\b|withdraw|cash out/i, "withdrawal"],
  [/شراء|purchase|pos\b|apple ?pay|مدى|mada|عملية دفع|payment|دفع|spent|خصم/i, "purchase"],
];

const CURRENCY = "(?:SAR|SR|ر\\.?\\s?س\\.?|ريال)";
const NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
const BALANCE_LINE = /الرصيد|رصيد|balance|available|المتاح|حد الائتمان|limit/i;

function toHalalas(s: string): number | null {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function findAmount(text: string): number | null {
  const lines = text.split("\n").filter((l) => !BALANCE_LINE.test(l));
  // A line that only mentions the balance is skipped, but "الرصيد" can share a line with the amount in one-line
  // messages, so fall back to cutting the balance tail off instead of dropping the whole message.
  const body = lines.length ? lines : text.split("\n").map((l) => l.split(BALANCE_LINE)[0]);
  const cleaned = body.map((l) => l.split(BALANCE_LINE)[0]).join("\n");
  const patterns = [
    new RegExp(`${CURRENCY}\\s*:?\\s*${NUM}`, "i"),
    new RegExp(`${NUM}\\s*${CURRENCY}`, "i"),
    new RegExp(`(?:مبلغ|بمبلغ|بقيمة|قيمة|amount|المبلغ)\\s*:?\\s*${NUM}`, "i"),
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m) return toHalalas(m[1]);
  }
  return null;
}

function tidyMerchant(raw: string): string | null {
  let m = raw
    .split(/\n|\s+(?:من|on|with|via|using|عبر|مع)\s|بطاقة|ببطاقة|card|مدى|mada|visa|mastercard|الرصيد|balance|في\s*:|on\s+\d|بتاريخ|\bat\s+\d|\*{2,}/i)[0]
    .replace(/^[\s:：\-–]+/, "")
    .replace(/\b(?:SAR|SR)\b.*$/i, "")
    .replace(/[\s.,;:\-–]+$/, "")
    .trim();
  if (m.length < 2) return null;
  m = m.replace(/\s{2,}/g, " ");
  return m.slice(0, 80);
}

function findMerchant(text: string): string | null {
  const patterns = [
    /(?:لدى|عند|التاجر|اسم التاجر|merchant|المتجر)\s*[:：]?\s*(.+)/i,
    /\b(?:at|@)\s+([^\n]+)/i,
    /(?:من متجر|الى متجر|إلى متجر|لطلبك|لطلب|طلبك|order (?:from|at))\s*[:：]?\s*(?:من\s+)?(.+)/i,
    /(?:إلى|الى|to)\s*[:：]\s*(.+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const t = tidyMerchant(m[1]);
      if (t) return t;
    }
  }
  return null;
}

function findCard(text: string): string | null {
  const m =
    text.match(/(?:بطاقة|ببطاقة|card|مدى|mada|visa|mastercard|\*{2,}|x{2,}|\.{3,})[^\d\n]{0,12}(\d{4})\b/i) ??
    text.match(/\*+\s?(\d{4})\b/);
  return m ? m[1] : null;
}

function validDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function findDate(text: string, today: string): string | null {
  let out: string | null = null;
  let m = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) out = validDate(+m[1], +m[2], +m[3]);
  if (!out) {
    m = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2}|\d{2})\b/);
    if (m) out = validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]); // Saudi order: day/month/year
  }
  if (!out) return null;
  // A date more than a day ahead is a misread; fall back to "today" on the server.
  return out > addOneDay(today) ? null : out;
}

function addOneDay(s: string): string {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) + 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Turn one bank SMS into structured fields. Anything it cannot read confidently stays null/unknown. */
export function parseSms(rawText: string, opts: { sender?: string; today: string }): Parsed {
  const text = normalizeText(rawText);
  const probe = `${opts.sender ?? ""}\n${text}`;
  const bank = BANKS.find(([re]) => re.test(probe))?.[1] ?? null;
  const direction = DIRECTIONS.find(([re]) => re.test(text))?.[1] ?? "unknown";
  const amount = findAmount(text);
  const merchant = findMerchant(text);
  return {
    bank,
    direction,
    amount_halalas: amount,
    merchant,
    merchant_key: merchantKey(merchant),
    card_last4: findCard(text),
    occurred_on: findDate(text, opts.today),
    category_hint: categoryHint(merchant),
  };
}

/** Messages with no amount (OTP codes, promotions, declined-card notices) are dropped, not stored. */
export const isFinancial = (p: Parsed) => p.amount_halalas !== null;
