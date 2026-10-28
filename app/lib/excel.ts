import type { ExportData } from "./export";

const riyals = (h: number) => h / 100;

/** A right-to-left workbook with one sheet per kind of data. Amounts are in riyals, not halalas. */
export async function buildWorkbook(data: ExportData): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "ميزان";
  const cat = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "";
  const line = (id: string | null) => data.lines.find((l) => l.id === id)?.name ?? "";

  const sheet = (name: string, cols: [string, number][], rows: (string | number | null)[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map(([header, width]) => ({ header, width }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    return ws;
  };

  const tx = sheet("العمليات", [["التاريخ", 12], ["النوع", 10], ["المبلغ (ر.س)", 14], ["التصنيف", 16], ["البند", 16], ["المحل", 24], ["المصدر", 10]],
    [...data.txs].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).map((t) => [
      t.occurred_on, t.kind === "refund" ? "استرداد" : "مصروف", riyals(t.amount_halalas) * (t.kind === "refund" ? -1 : 1),
      cat(t.category_id), line(data.categories.find((c) => c.id === t.category_id)?.line_id ?? null), t.merchant ?? "", t.source,
    ]));
  tx.getColumn(3).numFmt = "#,##0.00";

  sheet("البنود", [["البند", 18], ["النوع", 12], ["المبلغ الشهري الحالي (ر.س)", 22], ["رصيد افتتاحي (ر.س)", 18], ["بداية التتبع", 14], ["يدخل في المسموح اليوم", 20]],
    data.lines.map((l) => [
      l.name, l.kind, riyals([...l.plans].sort((a, b) => b.from.localeCompare(a.from))[0]?.amount_halalas ?? 0),
      riyals(l.opening_halalas), l.tracking_start, l.counts_daily ? "نعم" : "لا",
    ]));
  sheet("الالتزامات", [["الاسم", 20], ["المبلغ (ر.س)", 14], ["يوم الاستحقاق", 14], ["فعّال", 8]],
    data.commitments.map((c) => [c.name, riyals(c.amount_halalas), c.due_day, c.active ? "نعم" : "لا"]));
  sheet("الأقساط", [["الطلب", 20], ["الجهة", 10], ["مبلغ الدفعة (ر.س)", 16], ["عدد الدفعات", 12], ["المدفوع", 10], ["أول دفعة", 12], ["التكرار", 10]],
    data.plans.map((p) => [
      p.name, p.provider, riyals(p.installment_halalas), p.total_count,
      data.planPayments.filter((x) => x.plan_id === p.id).length, p.first_due, p.period,
    ]));
  sheet("الأهداف", [["الهدف", 20], ["المطلوب (ر.س)", 16], ["المدخر (ر.س)", 16], ["الموعد", 12]],
    data.goals.map((g) => [
      g.name, riyals(g.target_halalas),
      riyals(data.contributions.filter((c) => c.goal_id === g.id).reduce((s, c) => s + c.amount_halalas, 0)), g.deadline ?? "",
    ]));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
