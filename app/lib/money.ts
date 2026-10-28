// All amounts are stored as integer halalas (1 SAR = 100 halalas) to avoid float drift.

export const toHalalas = (riyals: number) => Math.round(riyals * 100);

export function fmt(halalas: number): string {
  const r = Math.abs(halalas) / 100;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(r) ? 0 : 2,
  }).format(r);
}

/** Signed display with a real minus sign, e.g. "−120" or "+1,240". */
export function fmtSigned(halalas: number): string {
  if (halalas === 0) return "0";
  return (halalas < 0 ? "−" : "+") + fmt(halalas);
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Accepts Arabic-Indic digits, Arabic separators and commas. Returns halalas or null. */
export function parseAmount(input: string): number | null {
  const s = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[٬,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const h = Math.round(parseFloat(s) * 100);
  return Number.isFinite(h) ? h : null;
}
