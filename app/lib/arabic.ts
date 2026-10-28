import { normalizeText } from "./sms/normalize";

/** Lowercase, Latin digits, no diacritics, one form of alef/teh marbuta/yeh: for matching, not display. */
export function norm(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1") // 1,200 -> 1200
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ") // keep decimal points, drop sentence dots
    .replace(/[؟?!،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop the definite article so "المطاعم" matches the category "مطاعم". */
export const stripAl = (w: string) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w);

/** Words of a normalized string, with the article stripped. */
export const words = (s: string) => norm(s).split(" ").filter(Boolean).map(stripAl);

/**
 * Word boundaries for regexes: JavaScript's \b only knows ASCII, so it never matches next to Arabic letters.
 * Wraps `pattern` so it must not be glued to another letter or digit.
 */
export const wordRe = (pattern: string, flags = "") =>
  new RegExp(`(?<![\\u0600-\\u06ff\\w])(?:${pattern})(?![\\u0600-\\u06ff\\w])`, flags);
