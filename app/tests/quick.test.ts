import { describe, expect, it } from "vitest";
import { parseQuick } from "@/lib/quick";
import type { Category, Rule } from "@/lib/types";

const cats: Category[] = [
  { id: "coffee", name: "قهوة", emoji: "☕", sort: 0, line_id: null },
  { id: "fuel", name: "بنزين", emoji: "⛽", sort: 1, line_id: null },
  { id: "food", name: "مطاعم", emoji: "🍽️", sort: 2, line_id: null },
  { id: "groc", name: "بقالة", emoji: "🛒", sort: 3, line_id: null },
];
// 2026-10-28 is a Wednesday.
const today = "2026-10-28";
const q = (s: string, rules: Rule[] = []) => parseQuick(s, { today, categories: cats, rules });

describe("parseQuick", () => {
  it("قهوة ١٨", () => {
    expect(q("قهوة ١٨")).toMatchObject({ amount_halalas: 1800, date: today, kind: "expense", merchant: "قهوة", category_id: "coffee", dateFromText: false });
  });
  it("بنزين ٩٠ أمس", () => {
    expect(q("بنزين ٩٠ أمس")).toMatchObject({ amount_halalas: 9000, date: "2026-10-27", category_id: "fuel", dateFromText: true });
  });
  it("amount first, with decimals and a currency word", () => {
    expect(q("35.5 ريال مطعم")).toMatchObject({ amount_halalas: 3550, category_id: "food" });
    expect(q("٣٥٫٥ غداء")).toMatchObject({ amount_halalas: 3550 });
  });
  it("the definite article does not block a category match", () => {
    expect(q("المطاعم 60").category_id).toBe("food");
    expect(q("60 للقهوة").category_id).toBe("coffee"); // the built-in guess finds it inside the word
  });
  it("relative dates", () => {
    expect(q("بقالة 120 أول أمس").date).toBe("2026-10-26");
    expect(q("بقالة 120 قبل يومين").date).toBe("2026-10-26");
    expect(q("بقالة 120 قبل 5 ايام").date).toBe("2026-10-23");
    expect(q("بقالة 120 اليوم").date).toBe(today);
  });
  it("weekday names mean the most recent such day, never today", () => {
    expect(q("غداء 45 يوم الخميس").date).toBe("2026-10-22"); // last Thursday
    expect(q("غداء 45 الاربعاء").date).toBe("2026-10-21"); // today is Wednesday: a week ago
    expect(q("غداء 45 السبت").date).toBe("2026-10-24");
  });
  it("refunds", () => {
    expect(q("استرداد 50 نون")).toMatchObject({ kind: "refund", amount_halalas: 5000, merchant: "نون" });
  });
  it("a rule the user taught beats the built-in guess", () => {
    const rule: Rule = { id: "r", merchant_key: "ستاربكس", category_id: "food", ignore: false, hits: 0 };
    expect(q("ستاربكس 24", [rule]).category_id).toBe("food");
    expect(q("ستاربكس 24").category_id).toBe("coffee"); // built-in hint
  });
  it("an ignore rule is not used to categorise", () => {
    const rule: Rule = { id: "r", merchant_key: "ستاربكس", category_id: null, ignore: true, hits: 0 };
    expect(q("ستاربكس 24", [rule]).category_id).toBe("coffee");
  });
  it("no amount means no amount, not zero", () => {
    expect(q("قهوة").amount_halalas).toBeNull();
    expect(q("قهوة 0").amount_halalas).toBeNull();
    expect(q("").merchant).toBeNull();
  });
  it("unknown words become the merchant with no category", () => {
    expect(q("سوق الخضار 40")).toMatchObject({ merchant: "سوق الخضار", category_id: null, amount_halalas: 4000 });
  });
});
