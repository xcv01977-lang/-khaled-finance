const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits, plain spaces, no bidi marks or tatweel: one shape for every regex below. */
export function normalizeText(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/[‎‏‪-‮⁦-⁩ـ]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

const NOISE = new Set([
  "riyadh", "jeddah", "jedda", "dammam", "khobar", "makkah", "mecca", "madinah", "medina", "abha", "tabuk", "sa", "ksa", "sau",
  "saudi", "arabia", "co", "ltd", "llc", "est", "inc", "company", "branch", "br", "store", "shop", "www", "com",
  "الرياض", "جدة", "الدمام", "الخبر", "مكة", "المدينة", "ابها", "تبوك", "السعودية", "مؤسسة", "شركة", "فرع", "محل", "متجر", "مطعم",
]);

/**
 * Stable key for a merchant so "STARBUCKS RIYADH 1234" and "Starbucks jeddah" learn the same rule.
 * Lowercase, letters only, drops city and company words, keeps the first three words.
 */
export function merchantKey(name: string | null | undefined): string {
  if (!name) return "";
  const words = normalizeText(name)
    .toLowerCase()
    .replace(/[ًٌٍَُِّْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^a-zء-ي]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !NOISE.has(w));
  return words.slice(0, 3).join(" ");
}
