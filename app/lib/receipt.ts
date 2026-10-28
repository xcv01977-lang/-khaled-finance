import { findDate } from "./sms/parse";
import { normalizeText } from "./sms/normalize";

export type Receipt = {
  /** Only set when it is trustworthy: a labelled total, or subtotal + VAT. Otherwise null and the user picks. */
  amount_halalas: number | null;
  merchant: string | null;
  date: string | null;
  /** high: a line labelled as the total. derived: worked out as subtotal + VAT. low: no amount chosen. */
  confidence: "high" | "derived" | "low";
  /** Every plausible figure found, biggest first, for the user to pick from when nothing was certain. */
  candidates: number[];
};

const TOTAL = /(الاجمالي|الإجمالي|اجمالي|إجمالي|المجموع الكلي|المجموع|المبلغ المستحق|المستحق|المطلوب|الصافي|grand ?total|total|amount due|balance due|net total|to pay)/i;
const NOT_TOTAL = /(قبل الضريبة|بدون الضريبة|الضريبة|ضريبة|vat|tax|subtotal|sub total|sub-total|excl|خصم|discount|الباقي|المتبقي|change|نقد|نقدا|نقداً|cash|المدفوع|مدفوع|paid|tendered|رقم|number|no\.|هاتف|tel|phone|سجل|الرقم الضريبي)/i;
const INCLUDING = /(شامل|including|incl\b)/i;
const AMOUNT = /(?<![\d.,])(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d])/g;
const SUBTOTAL = /(قبل الضريبة|بدون الضريبة|بدون ضريبة|subtotal|sub total|sub-total|excl)/i;
const VAT_LINE = /(القيمة المضافة|الضريبة|ضريبة|vat|tax)/i;
const SKIP_MERCHANT = /(فاتورة|invoice|receipt|ضريب|tax|رقم|هاتف|tel|phone|كاشير|cashier|سجل|cr\b|vat|www|http|@|تاريخ|date|الوقت|time|شكرا|thank|welcome|اهلا)/i;

const toHalalas = (s: string) => Math.round(parseFloat(s.replace(/,/g, "")) * 100);
const amountsIn = (line: string) => [...line.matchAll(AMOUNT)].map((m) => toHalalas(m[1])).filter((n) => n > 0);

/** Read what an OCR pass found on a receipt. Everything it returns is a suggestion for the user to confirm. */
export function parseReceipt(ocrText: string, opts: { today: string }): Receipt {
  const text = normalizeText(ocrText);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const candidates = [...new Set(lines.filter((l) => !/(رقم|number|no\.|هاتف|tel|phone|سجل|الرقم الضريبي)/i.test(l)).flatMap(amountsIn))]
    .sort((a, b) => b - a)
    .slice(0, 6);

  // The total the receipt prints, if one line is clearly labelled and is not the subtotal, VAT, cash given or change.
  const labelled = lines.filter((l) => TOTAL.test(l) && (!NOT_TOTAL.test(l) || INCLUDING.test(l))).flatMap(amountsIn);
  const printed = labelled.length ? Math.max(...labelled) : null;

  // Subtotal + VAT, which rescues the common case where OCR garbles the big bold total line.
  const sub = lines.filter((l) => SUBTOTAL.test(l)).flatMap(amountsIn);
  const vat = lines.filter((l) => VAT_LINE.test(l) && !SUBTOTAL.test(l)).flatMap((l) => amountsIn(l).slice(-1));
  const derived = sub.length && vat.length ? Math.max(...sub) + Math.max(...vat) : null;

  let amount: number | null = null;
  let confidence: Receipt["confidence"] = "low";
  if (printed !== null && (derived === null || printed === derived || printed >= (sub.length ? Math.max(...sub) : 0))) {
    amount = printed;
    confidence = "high";
  } else if (derived !== null) {
    amount = derived;
    confidence = "derived";
  }

  const merchant =
    lines.slice(0, 6).find((l) => {
      const letters = (l.match(/[A-Za-zء-ي]/g) ?? []).length;
      return letters >= 3 && letters / l.length >= 0.5 && !SKIP_MERCHANT.test(l) && !/\d{4,}/.test(l);
    }) ?? null;

  return {
    amount_halalas: amount,
    merchant: merchant ? merchant.replace(/[^A-Za-zء-ي0-9 &'.\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || null : null,
    date: findDate(text, opts.today),
    confidence,
    candidates,
  };
}
