import { describe, expect, it } from "vitest";
import { parseReceipt } from "@/lib/receipt";

const today = "2026-10-28";
const p = (t: string) => parseReceipt(t, { today });

describe("parseReceipt", () => {
  it("reads an Arabic receipt: total, not the subtotal or the VAT", () => {
    const r = p(`مطعم البيك
الرياض - حي الملقا
التاريخ: 2026-10-28 14:35
برجر دجاج 2 × 18.00 36.00
بطاطس 1 × 8.00 8.00
المجموع قبل الضريبة 44.00
ضريبة القيمة المضافة 15% 6.60
الإجمالي 50.60 ر.س`);
    expect(r).toMatchObject({ amount_halalas: 5060, merchant: "مطعم البيك", date: "2026-10-28", confidence: "high" });
  });

  it("reads an English receipt and ignores cash tendered and change", () => {
    const r = p(`STARBUCKS COFFEE
Branch 1234 Riyadh
Date 28/10/2026
Latte 1 22.00
Croissant 1 14.00
Subtotal 36.00
VAT 15% 5.40
TOTAL 41.40
Cash 50.00
Change 8.60`);
    expect(r).toMatchObject({ amount_halalas: 4140, merchant: "STARBUCKS COFFEE", date: "2026-10-28", confidence: "high" });
  });

  it("converts Arabic-Indic digits from the OCR", () => {
    expect(p("بنده\nالإجمالي ١٢٣٫٤٥").amount_halalas).toBe(12345);
  });

  it("accepts a total that says it includes VAT", () => {
    expect(p("نون\nالإجمالي شامل الضريبة 115.00\nالضريبة 15.00").amount_halalas).toBe(11500);
  });

  it("handles thousands separators", () => {
    expect(p("جرير\nTotal 1,249.75").amount_halalas).toBe(124975);
  });

  it("does not guess: with no total it offers the figures it found and leaves the amount empty", () => {
    const r = p("كافيه\nلاتيه 22.00\nكيك 18.00\nضريبة 6.00\nنقد 100.00");
    expect(r.amount_halalas).toBeNull();
    expect(r.confidence).toBe("low");
    expect(r.candidates).toEqual([10000, 2200, 1800, 600]);
  });

  it("works out the total from subtotal + VAT when OCR garbled the total line", () => {
    // what the engine really returned for the bold "الإجمالي 50.60 ر.س" line
    const r = p(`مطهم البيك
التاريخ: 28-10-2026 14:35
برجر دجاج 2 x 18.00 36.00
المجموع قبل الضريبة 44.00
ضريبة القيمة المضافة 1615 6.60
wiles 0 ر.س`);
    expect(r).toMatchObject({ amount_halalas: 5060, confidence: "derived", date: "2026-10-28" });
    expect(r.candidates).toContain(5060 - 660); // the subtotal is among the options too
  });

  it("does not trust a printed total smaller than the subtotal", () => {
    const r = p("متجر\nالمجموع قبل الضريبة 100.00\nالضريبة 15.00\nالإجمالي 11.50");
    expect(r).toMatchObject({ amount_halalas: 11500, confidence: "derived" });
  });

  it("returns nothing for text with no amounts rather than guessing", () => {
    expect(p("شكرا لزيارتكم\nنتمنى لكم يوما سعيدا")).toMatchObject({ amount_halalas: null, confidence: "low", candidates: [] });
    expect(p("")).toMatchObject({ amount_halalas: null, merchant: null, date: null });
  });

  it("skips header lines when looking for the merchant", () => {
    expect(p("فاتورة ضريبية مبسطة\nالرقم الضريبي 300123456700003\nمخبز الصباح\nالإجمالي 12.00").merchant).toBe("مخبز الصباح");
  });

  it("does not take a date from the future", () => {
    expect(p("متجر\nالتاريخ 2026-12-31\nالإجمالي 10.00").date).toBeNull();
  });
});
