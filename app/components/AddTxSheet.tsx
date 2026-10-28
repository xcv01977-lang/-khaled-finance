"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { addDays } from "@/lib/cycle";
import { parseAmount } from "@/lib/money";
import type { Kind, Tx } from "@/lib/types";

type When = "today" | "yesterday" | "custom";

export default function AddTxSheet({ editing, onClose }: { editing?: Tx; onClose: () => void }) {
  const { categories, today, saveTx, deleteTx } = useFinance();
  const yesterday = addDays(today, -1);

  const [kind, setKind] = useState<Kind>(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount_halalas / 100) : "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [when, setWhen] = useState<When>(
    !editing || editing.occurred_on === today ? "today" : editing.occurred_on === yesterday ? "yesterday" : "custom",
  );
  const [custom, setCustom] = useState(editing?.occurred_on ?? today);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const date = when === "today" ? today : when === "yesterday" ? yesterday : custom;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseAmount(amount);
    if (!h || h <= 0) return setErr("اكتب مبلغ صحيح");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr("التاريخ غير صحيح");
    setBusy(true);
    const ok = await saveTx({
      id: editing?.id, amount_halalas: h, kind, category_id: categoryId,
      merchant: merchant.trim() || null, note: editing?.note ?? null, occurred_on: date,
    });
    setBusy(false);
    if (ok) onClose();
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deleteTx(editing.id);
    setBusy(false);
    if (ok) onClose();
  }

  const seg = (on: boolean) =>
    `flex-1 rounded-xl px-3 py-2 text-sm transition ${on ? "bg-acc font-semibold text-onacc" : "bg-soft text-mut"}`;

  return (
    <Sheet open onClose={onClose} title={editing ? "تعديل عملية" : "عملية جديدة"}>
      <form onSubmit={submit} className="grid gap-4">
        <div className="flex gap-2" role="group" aria-label="نوع العملية">
          <button type="button" aria-pressed={kind === "expense"} onClick={() => setKind("expense")} className={seg(kind === "expense")}>مصروف</button>
          <button type="button" aria-pressed={kind === "refund"} onClick={() => setKind("refund")} className={seg(kind === "refund")}>استرداد</button>
        </div>

        <div>
          <label htmlFor="amount" className="sr-only">المبلغ بالريال</label>
          <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-bg px-4 py-3">
            <input
              id="amount" autoFocus inputMode="decimal" autoComplete="off" dir="ltr" placeholder="0"
              value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }}
              className="num w-full bg-transparent text-4xl font-medium outline-none"
            />
            <span className="text-mut">ر.س</span>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm text-mut">التصنيف</div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id} type="button" aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${categoryId === c.id ? "bg-acc font-semibold text-onacc" : "bg-soft"}`}
              >
                <span aria-hidden>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="merchant" className="mb-2 block text-sm text-mut">المحل أو الوصف (اختياري)</label>
          <input
            id="merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={80}
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3"
          />
        </div>

        <div>
          <div className="mb-2 text-sm text-mut">التاريخ</div>
          <div className="flex gap-2" role="group" aria-label="التاريخ">
            <button type="button" aria-pressed={when === "today"} onClick={() => setWhen("today")} className={seg(when === "today")}>اليوم</button>
            <button type="button" aria-pressed={when === "yesterday"} onClick={() => setWhen("yesterday")} className={seg(when === "yesterday")}>أمس</button>
            <button type="button" aria-pressed={when === "custom"} onClick={() => setWhen("custom")} className={seg(when === "custom")}>تاريخ آخر</button>
          </div>
          {when === "custom" && (
            <input
              type="date" aria-label="اختر التاريخ" value={custom} onChange={(e) => setCustom(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3" dir="ltr"
            />
          )}
        </div>

        {err && <p role="alert" className="text-sm text-bad">{err}</p>}

        <div className="flex gap-2">
          <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">
            {busy ? "لحظة…" : "حفظ"}
          </button>
          {editing && (
            <button type="button" onClick={remove} disabled={busy}
              className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
              {confirmDelete ? "تأكيد الحذف" : "حذف"}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
