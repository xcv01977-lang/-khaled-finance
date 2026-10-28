import { describe, expect, it } from "vitest";
import { planIngest } from "@/lib/sms/ingest";
import { parseSms } from "@/lib/sms/parse";
import type { Category, Rule } from "@/lib/types";

const cats: Category[] = [
  { id: "c-coffee", name: "قهوة", emoji: "☕", sort: 0, line_id: null },
  { id: "c-food", name: "مطاعم", emoji: "🍽️", sort: 1, line_id: null },
];
const parse = (t: string) => parseSms(t, { today: "2026-10-28" });
const plan = (t: string, rules: Rule[] = [], isDuplicate = false) =>
  planIngest(parse(t), { rules, categories: cats, isDuplicate });

describe("planIngest", () => {
  it("records a known-merchant purchase with a guessed category, flagged for review", () => {
    const r = plan("شراء بمبلغ 45.50 SAR لدى STARBUCKS");
    expect(r.status).toBe("review");
    expect(r.tx).toEqual({ amount_halalas: 4550, kind: "expense", category_id: "c-coffee", merchant: "STARBUCKS" });
  });

  it("a taught rule wins over the built-in guess and is recorded without review", () => {
    const rule: Rule = { id: "r1", merchant_key: "starbucks", category_id: "c-food", ignore: false, hits: 0 };
    const r = plan("شراء بمبلغ 45.50 SAR لدى STARBUCKS", [rule]);
    expect(r.status).toBe("auto");
    expect(r.tx?.category_id).toBe("c-food");
    expect(r.ruleHit).toBe("r1");
  });

  it("an unknown merchant is still recorded (numbers stay right) but uncategorised and flagged", () => {
    const r = plan("شراء بمبلغ 20 SAR لدى QWERTY SHOP");
    expect(r.status).toBe("review");
    expect(r.tx).toMatchObject({ amount_halalas: 2000, category_id: null });
  });

  it("an ignore rule records nothing", () => {
    const rule: Rule = { id: "r2", merchant_key: "starbucks", category_id: null, ignore: true, hits: 0 };
    expect(plan("شراء بمبلغ 45 SAR لدى STARBUCKS", [rule])).toMatchObject({ status: "ignored", tx: null });
  });

  it("deposits and incoming transfers are never spending", () => {
    expect(plan("إيداع راتب بمبلغ 10,000.00 SAR").status).toBe("ignored");
    expect(plan("حوالة واردة بمبلغ 200 SAR").status).toBe("ignored");
  });

  it("outgoing transfers, instalments and unknown messages wait for a person", () => {
    for (const t of ["حوالة صادرة بمبلغ 500 SAR إلى محمد", "تابي: تم خصم 125 ر.س كدفعة 2 من 4", "حدث شيء بمبلغ 5 SAR"]) {
      expect(plan(t)).toMatchObject({ status: "review", tx: null });
    }
  });

  it("a refund becomes a refund transaction", () => {
    expect(plan("استرجاع مبلغ 45.50 SAR من STARBUCKS").tx?.kind).toBe("refund");
  });

  it("a duplicate records nothing", () => {
    expect(plan("شراء بمبلغ 45.50 SAR لدى STARBUCKS", [], true)).toMatchObject({ status: "duplicate", tx: null });
  });

  it("a purchase without a readable amount is unparsed", () => {
    expect(plan("شراء من متجر لدى QWERTY")).toMatchObject({ status: "unparsed", tx: null });
  });
});
