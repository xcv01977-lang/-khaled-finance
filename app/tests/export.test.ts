import { describe, expect, it } from "vitest";
import { buildWorkbook } from "@/lib/excel";
import { buildExport, parseExport } from "@/lib/export";
import { DEFAULT_SETTINGS, type Snapshot } from "@/lib/types";

const snap: Snapshot = {
  settings: { ...DEFAULT_SETTINGS, salary_halalas: 1_000_000, ingest_token_hash: "secret-hash" },
  categories: [{ id: "c1", name: "قهوة", emoji: "☕", sort: 0, line_id: "L1" }],
  lines: [{
    id: "L1", name: "مصاريف", emoji: "💸", kind: "expenses", counts_daily: true,
    plans: [{ from: "2026-10-27", amount_halalas: 300_000 }], opening_halalas: -5000, tracking_start: "2026-10-27", sort: 0, active: true,
  }],
  txs: [
    { id: "t1", amount_halalas: 1850, kind: "expense", category_id: "c1", merchant: "ستاربكس", note: null, occurred_on: "2026-10-28", source: "sms" },
    { id: "t2", amount_halalas: 500, kind: "refund", category_id: "c1", merchant: "ستاربكس", note: null, occurred_on: "2026-10-28", source: "manual" },
  ],
  commitments: [{ id: "m1", name: "الإيجار", emoji: "🏠", amount_halalas: 320_000, due_day: 1, active: true }],
  payments: [{ id: "p1", commitment_id: "m1", cycle_start: "2026-09-27", paid_on: "2026-10-01", amount_halalas: 320_000 }],
  inbox: [{ id: "i1", raw_text: "OTP 1234", bank: null, direction: "unknown", amount_halalas: null, merchant: null, merchant_key: "", card_last4: null, occurred_on: null, status: "review", transaction_id: null, created_at: "2026-10-28T10:00:00Z" }],
  rules: [{ id: "r1", merchant_key: "ستاربكس", category_id: "c1", ignore: false, hits: 3 }],
  plans: [{ id: "pl1", name: "نون", provider: "tabby", installment_halalas: 12500, total_count: 4, first_due: "2026-10-30", period: "monthly", active: true }],
  planPayments: [{ id: "pp1", plan_id: "pl1", number: 1, paid_on: "2026-10-30", amount_halalas: 12500 }],
  goals: [{ id: "g1", name: "سفر", emoji: "✈️", target_halalas: 1_200_000, monthly_halalas: 50_000, deadline: null, created_on: "2026-06-01" }],
  contributions: [{ id: "gc1", goal_id: "g1", amount_halalas: 200_000, on: "2026-10-01" }],
};

describe("export / import", () => {
  it("round-trips everything the user entered, byte for byte", () => {
    const file = buildExport(snap, new Date("2026-10-28T12:00:00Z"));
    const back = parseExport(JSON.stringify(file));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.data).toEqual(file.data);
    expect(back.data.txs).toEqual(snap.txs);
    expect(back.data.lines[0].plans).toEqual(snap.lines[0].plans);
    expect(back.data.lines[0].opening_halalas).toBe(-5000);
    expect(back.counts).toEqual({ transactions: 2, categories: 1, lines: 1, commitments: 1, plans: 1, goals: 1 });
    expect(back.exportedAt).toBe("2026-10-28T12:00:00.000Z");
  });

  it("never exports the Shortcut key or the raw message log", () => {
    const text = JSON.stringify(buildExport(snap));
    expect(text).not.toContain("secret-hash");
    expect(text).not.toContain("ingest_token_hash");
    expect(text).not.toContain("OTP 1234");
  });

  it("refuses files that are not Mizan exports", () => {
    expect(parseExport("not json")).toMatchObject({ ok: false, error: expect.stringContaining("JSON") });
    expect(parseExport("{}")).toMatchObject({ ok: false });
    expect(parseExport(JSON.stringify({ format: "other", version: 1, data: {} }))).toMatchObject({ ok: false });
    expect(parseExport(JSON.stringify({ ...buildExport(snap), version: 99 }))).toMatchObject({ ok: false, error: expect.stringContaining("أحدث") });
  });

  it("refuses damaged rows and names the problem instead of importing part of them", () => {
    const bad = (mutate: (d: ReturnType<typeof buildExport>["data"]) => void) => {
      const f = JSON.parse(JSON.stringify(buildExport(snap)));
      mutate(f.data);
      return parseExport(JSON.stringify(f));
    };
    const zero = bad((d) => { d.txs[0].amount_halalas = 0; });
    expect(zero).toMatchObject({ ok: false, error: expect.stringContaining("amount_halalas") });
    expect(bad((d) => { d.txs[0].occurred_on = "28/10/2026"; })).toMatchObject({ ok: false });
    expect(bad((d) => { (d.txs[1] as { kind: string }).kind = "gift"; })).toMatchObject({ ok: false });
    expect(bad((d) => { d.commitments[0].due_day = 40; })).toMatchObject({ ok: false });
    expect(bad((d) => { (d as unknown as { goals: unknown }).goals = "x"; })).toMatchObject({ ok: false });
    expect(bad((d) => { d.contributions[0].amount_halalas = 0; })).toMatchObject({ ok: false });
  });

  it("an export from an older version without newer sections still imports", () => {
    const f = JSON.parse(JSON.stringify(buildExport(snap)));
    delete f.data.plans; delete f.data.goals; delete f.data.contributions;
    const r = parseExport(JSON.stringify(f));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.goals).toEqual([]);
  });
});

describe("excel", () => {
  it("writes a right-to-left workbook with amounts in riyals and refunds as negatives", async () => {
    const { Workbook } = await import("exceljs");
    const buf = await buildWorkbook(buildExport(snap).data);
    const wb = new Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["العمليات", "البنود", "الالتزامات", "الأقساط", "الأهداف"]);
    const tx = wb.getWorksheet("العمليات")!;
    expect(tx.views[0]).toMatchObject({ rightToLeft: true });
    const amounts = [2, 3].map((r) => tx.getRow(r).getCell(3).value);
    expect(amounts.sort()).toEqual([-5, 18.5]);
    expect(wb.getWorksheet("البنود")!.getRow(2).getCell(3).value).toBe(3000);
    expect(wb.getWorksheet("الأقساط")!.getRow(2).getCell(5).value).toBe(1); // payments made
    expect(wb.getWorksheet("الأهداف")!.getRow(2).getCell(3).value).toBe(2000);
  });
});
