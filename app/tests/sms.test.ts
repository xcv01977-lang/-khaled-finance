import { describe, expect, it } from "vitest";
import { categoryHint } from "@/lib/sms/hints";
import { merchantKey, normalizeText } from "@/lib/sms/normalize";
import { isFinancial, parseSms } from "@/lib/sms/parse";

const today = "2026-10-28";
const p = (text: string, sender?: string) => parseSms(text, { today, sender });

// NOTE: these are representative message shapes written from memory of common Saudi bank formats,
// not copies of real messages. Real samples should be added here as they appear.
describe("parseSms: banks", () => {
  it("Al Rajhi style multi-line purchase", () => {
    const r = p("عملية شراء عبر مدى\nبمبلغ: SAR 45.50\nلدى: STARBUCKS RIYADH\nبطاقة: **1234\nفي: 2026-10-28 14:32\nالرصيد: SAR 3,200.00", "AlRajhiBank");
    expect(r).toMatchObject({
      bank: "الراجحي", direction: "purchase", amount_halalas: 4550, merchant: "STARBUCKS RIYADH",
      merchant_key: "starbucks", card_last4: "1234", occurred_on: "2026-10-28", category_hint: "قهوة",
    });
  });

  it("Al Ahli with Arabic-Indic digits and dd/mm/yy date", () => {
    const r = p("شراء\nمبلغ: ١٢٠٫٠٠ SAR\nلدى: PANDA RETAIL\nبطاقة مدى: ٥٦٧٨\n٢٨/١٠/٢٦ ١٩:١٠\nالأهلي", "SNB");
    expect(r).toMatchObject({
      bank: "الأهلي", direction: "purchase", amount_halalas: 12000, card_last4: "5678",
      occurred_on: "2026-10-28", category_hint: "بقالة",
    });
  });

  it("Alinma one-line message, balance on the same line is not the amount", () => {
    const r = p("إنماء: شراء بمبلغ 250.00 ريال لدى NAHDI MEDICAL ببطاقة مدى ***4321 في 28-10-2026 الرصيد 1000.00");
    expect(r).toMatchObject({
      bank: "الإنماء", direction: "purchase", amount_halalas: 25000, merchant: "NAHDI MEDICAL",
      card_last4: "4321", occurred_on: "2026-10-28", category_hint: "صحة",
    });
  });

  it("STC Bank", () => {
    const r = p("STC Bank: تمت عملية شراء بقيمة 33.00 SAR لدى Jahez من بطاقة ****9012");
    expect(r).toMatchObject({ bank: "STC Bank", direction: "purchase", amount_halalas: 3300, merchant: "Jahez", card_last4: "9012", category_hint: "مطاعم" });
  });

  it("D360 in English", () => {
    const r = p("D360: Purchase of SAR 15.00 at Dunkin on card ending 3456. Balance SAR 100.00");
    expect(r).toMatchObject({ bank: "D360", direction: "purchase", amount_halalas: 1500, merchant: "Dunkin", card_last4: "3456", category_hint: "قهوة" });
  });

  it("amount with thousands separator", () => {
    expect(p("شراء بمبلغ 1,250.75 ريال لدى IKEA").amount_halalas).toBe(125075);
  });
});

describe("parseSms: money events", () => {
  it("refund", () => {
    const r = p("استرجاع مبلغ 45.50 SAR من STARBUCKS إلى بطاقتك 1234");
    expect(r).toMatchObject({ direction: "refund", amount_halalas: 4550 });
  });
  it("salary deposit is a deposit, not spending", () => {
    expect(p("إيداع راتب بمبلغ 10,000.00 SAR الرصيد 13,200.00")).toMatchObject({ direction: "deposit", amount_halalas: 1000000 });
  });
  it("outgoing transfer is not a purchase", () => {
    expect(p("حوالة صادرة بمبلغ 500.00 SAR إلى محمد").direction).toBe("transfer_out");
  });
  it("incoming transfer", () => {
    expect(p("حوالة واردة بمبلغ 200.00 SAR من فهد").direction).toBe("transfer_in");
  });
  it("ATM withdrawal", () => {
    expect(p("سحب نقدي SAR 300.00 من الصراف الآلي بطاقة 1234")).toMatchObject({ direction: "withdrawal", amount_halalas: 30000 });
  });
  it("Tabby and Tamara instalments are flagged as instalments", () => {
    const t = p("تابي: تم خصم 125.00 ر.س كدفعة 2 من 4 لطلبك من Noon");
    expect(t).toMatchObject({ bank: "تابي", direction: "installment", amount_halalas: 12500, merchant: "Noon" });
    const m = p("تمارا: تم تحصيل الدفعة 3 من 4 بمبلغ 80 ريال لطلب Shein");
    expect(m).toMatchObject({ bank: "تمارا", direction: "installment", amount_halalas: 8000 });
  });
});

describe("parseSms: safety", () => {
  it("never treats an OTP or promo as money", () => {
    expect(isFinancial(p("رمز التحقق لعملية دفع هو 482913. لا تشاركه مع أحد"))).toBe(false);
    expect(isFinancial(p("عرض خاص! خصم 20% على بطاقتك"))).toBe(false);
  });
  it("a card number alone is not an amount", () => {
    expect(p("تم رفض عملية شراء ببطاقة 1234").amount_halalas).toBeNull();
  });
  it("ignores the balance when it is the only SAR figure", () => {
    expect(p("الرصيد المتاح SAR 5,000.00").amount_halalas).toBeNull();
  });
  it("rejects a date in the future", () => {
    expect(p("شراء بمبلغ 10 SAR لدى X في 2026-12-31").occurred_on).toBeNull();
  });
  it("accepts yesterday's date", () => {
    expect(p("شراء بمبلغ 10 SAR لدى X في 2026-10-27").occurred_on).toBe("2026-10-27");
  });
  it("returns nulls rather than guessing on gibberish", () => {
    expect(p("hello world")).toMatchObject({ bank: null, direction: "unknown", amount_halalas: null, merchant: null });
  });
});

describe("merchantKey and hints", () => {
  it("groups the same merchant across branches and cities", () => {
    expect(merchantKey("STARBUCKS RIYADH 1234")).toBe("starbucks");
    expect(merchantKey("Starbucks - Jeddah Branch")).toBe("starbucks");
    expect(merchantKey("PANDA RETAIL CO")).toBe("panda retail");
  });
  it("handles Arabic names and variants", () => {
    expect(merchantKey("مطعم البيك - الرياض")).toBe("البيك");
    expect(merchantKey("إكسترا")).toBe(merchantKey("اكسترا"));
  });
  it("empty in, empty out", () => {
    expect(merchantKey(null)).toBe("");
    expect(merchantKey("123 456")).toBe("");
  });
  it("normalizes digits and bidi marks", () => {
    expect(normalizeText("‏١٢٫٥ ر.س")).toBe("12.5 ر.س");
  });
  it("hints a category only for well-known merchants", () => {
    expect(categoryHint("ALBAIK")).toBe("مطاعم");
    expect(categoryHint("Aldrees Petrol")).toBe("بنزين");
    expect(categoryHint("Random Shop XYZ")).toBeNull();
  });
});
