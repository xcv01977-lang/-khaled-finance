import { norm, stripAl, wordRe } from "./arabic";
import { addDays } from "./cycle";
import { merchantKey } from "./sms/normalize";
import { categoryHint } from "./sms/hints";
import type { Category, Kind, Rule } from "./types";

export type Quick = {
  amount_halalas: number | null;
  date: string;
  kind: Kind;
  merchant: string | null;
  category_id: string | null;
  /** True when the date came from the words typed, so the screen can show it. */
  dateFromText: boolean;
};

const WEEKDAYS: [string, number][] = [
  ["الاحد", 0], ["الاثنين", 1], ["الاتنين", 1], ["الثلاثاء", 2], ["الاربعاء", 3], ["الخميس", 4], ["الجمعه", 5], ["السبت", 6],
];

const REFUND = /(استرداد|استرجاع|مرتجع|رجعوا|رجع لي|رجّع)/;

function weekdayOf(date: string): number {
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay();
}

/** Most recent date on or before `today` that falls on the given weekday, never today itself. */
function lastWeekday(today: string, wd: number): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    if (weekdayOf(d) === wd) return d;
  }
  return today;
}

/**
 * Understand "قهوة 18" or "بنزين ٩٠ أمس" or "غداء 45 قبل ٣ أيام" or "استرداد 50 نون".
 * Amount is the first number; everything left after removing it and the date words is the description.
 */
export function parseQuick(input: string, opts: { today: string; categories: Category[]; rules: Rule[] }): Quick {
  const { today, categories, rules } = opts;
  let text = norm(input);

  let amount: number | null = null;
  const m = text.match(/(\d+(?:\.\d{1,2})?)/);
  if (m) {
    const n = Math.round(parseFloat(m[1]) * 100);
    amount = n > 0 ? n : null;
    text = text.replace(m[0], " ");
  }

  let date = today;
  let dateFromText = false;
  const set = (d: string, re: RegExp) => { date = d; dateFromText = true; text = text.replace(re, " "); };
  let r: RegExpMatchArray | null;
  const AFTER_TOMORROW = wordRe("اول امس|قبل امس|امس الاول");
  const YESTERDAY = wordRe("امس");
  const TWO_DAYS = wordRe("قبل يومين");
  const N_DAYS = wordRe("قبل (\\d{1,2}) (?:ايام|يوم)");
  const TODAY = wordRe("اليوم");
  if (AFTER_TOMORROW.test(text)) set(addDays(today, -2), AFTER_TOMORROW);
  else if (YESTERDAY.test(text)) set(addDays(today, -1), YESTERDAY);
  else if (TWO_DAYS.test(text)) set(addDays(today, -2), TWO_DAYS);
  else if ((r = text.match(N_DAYS))) set(addDays(today, -Number(r[1])), N_DAYS);
  else if (TODAY.test(text)) set(today, TODAY);
  else {
    for (const [name, wd] of WEEKDAYS) {
      const re = wordRe(`(?:يوم )?${name}`);
      if (re.test(text)) { set(lastWeekday(today, wd), re); break; }
    }
  }

  const kind: Kind = REFUND.test(text) ? "refund" : "expense";

  // The description keeps the user's own spelling: drop only the tokens that carried the amount, the money
  // word, the refund word and (when a date was understood) the date words.
  const DATE_TOKENS = new Set(["امس", "اول", "قبل", "يومين", "ايام", "يوم", "اليوم", ...WEEKDAYS.map(([n]) => n)]);
  const kept = input.trim().split(/\s+/).filter((tok) => {
    const t = norm(tok);
    if (!t || /^\d+(\.\d+)?$/.test(t) || REFUND.test(t) || wordRe("ريال|ريالات|ر س|sar|sr", "i").test(t)) return false;
    if (wordRe("مبلغ|بمبلغ|ب").test(t)) return false;
    return !(dateFromText && DATE_TOKENS.has(t));
  });
  const description = kept.join(" ").trim() || null;

  const category_id = guessCategory(description, categories, rules);

  return { amount_halalas: amount, date, kind, merchant: description, category_id, dateFromText };
}

/**
 * Pick a category for a merchant or description: 1. what the user taught, 2. a category named in the words,
 * 3. a built-in guess for well-known places. Null when none applies.
 */
export function guessCategory(description: string | null, categories: Category[], rules: Rule[]): string | null {
  if (!description) return null;
  const text = norm(description);
  const rule = rules.find((x) => !x.ignore && x.category_id && x.merchant_key === merchantKey(description));
  if (rule?.category_id) return rule.category_id;
  const ws = text.split(" ").map(stripAl);
  const named = categories.find((c) => ws.includes(stripAl(norm(c.name))));
  if (named) return named.id;
  const hint = categoryHint(description) ?? categoryHint(text);
  return categories.find((c) => c.name === hint)?.id ?? null;
}
