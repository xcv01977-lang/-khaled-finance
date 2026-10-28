"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { Field, Segmented } from "./ui";
import { useFinance } from "@/hooks/useFinance";
import { inDaysLabel } from "@/lib/format";
import { progressOf } from "@/lib/installments";
import { diffDays } from "@/lib/cycle";
import { fmt, parseAmount } from "@/lib/money";
import type { InstallmentPeriod, InstallmentPlan } from "@/lib/types";

const PROVIDERS = [
  { value: "tabby", label: "تابي" }, { value: "tamara", label: "تمارا" }, { value: "other", label: "آخر" },
] as const;
const PERIODS: { value: InstallmentPeriod; label: string }[] = [
  { value: "monthly", label: "شهري" }, { value: "biweekly", label: "كل أسبوعين" }, { value: "weekly", label: "أسبوعي" },
];

export default function InstallmentsSheet({ onClose }: { onClose: () => void }) {
  const { plans, planPayments, today } = useFinance();
  const [editing, setEditing] = useState<InstallmentPlan | "new" | null>(null);
  const progress = plans.map((p) => ({ plan: p, pr: progressOf(p, planPayments) }));
  const active = progress.filter((x) => !x.pr.done);
  const done = progress.filter((x) => x.pr.done);
  const owed = active.reduce((s, x) => s + x.pr.remainingHalalas, 0);

  return (
    <Sheet open onClose={onClose} title={editing === null ? "الأقساط" : editing === "new" ? "قسط جديد" : "تعديل قسط"}>
      {editing === null ? (
        <div className="grid grid-cols-1 gap-3">
          {active.length > 0 && (
            <div className="rounded-2xl bg-bg p-3.5 text-center">
              <div className="text-sm text-mut">باقي عليك من الأقساط</div>
              <div className="num text-3xl font-medium">{fmt(owed)}</div>
              <div className="text-xs text-mut">ر.س على <span className="num">{active.length}</span> {active.length === 1 ? "خطة" : "خطط"}</div>
            </div>
          )}
          {plans.length === 0 && (
            <p className="text-sm leading-7 text-mut">
              أضف أقساط تابي وتمارا وأي تقسيط. تدخل «المدفوعات القادمة» تلقائياً بتواريخها، وتنخصم من ميزانيتك.
            </p>
          )}
          <ul className="grid gap-2">
            {active.map(({ plan, pr }) => (
              <li key={plan.id}>
                <button onClick={() => setEditing(plan)} className="w-full rounded-2xl bg-bg p-3.5 text-start">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{plan.name}{!plan.active && <span className="ms-2 text-xs text-mut">موقوف</span>}</span>
                    <span className="num">{fmt(plan.installment_halalas)}</span>
                  </div>
                  <div className="mt-1 text-xs text-mut">
                    {PROVIDERS.find((x) => x.value === plan.provider)?.label} · دفعة <span className="num">{pr.paid + 1}</span> من <span className="num">{pr.total}</span>
                    {pr.next && <> · {diffDays(today, pr.next.due) < 0 ? <span className="text-bad">{inDaysLabel(diffDays(today, pr.next.due))}</span> : inDaysLabel(diffDays(today, pr.next.due))}</>}
                  </div>
                  <div className="mt-2.5 flex gap-1" aria-hidden>
                    {Array.from({ length: pr.total }, (_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < pr.paid ? "bg-ok" : "bg-line"}`} />
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {done.length > 0 && (
            <p className="text-xs text-mut">خلصت: {done.map((d) => d.plan.name).join("، ")}</p>
          )}
          <button onClick={() => setEditing("new")} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">＋ أضف قسط</button>
        </div>
      ) : (
        <PlanForm plan={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}
    </Sheet>
  );
}

function PlanForm({ plan, onDone }: { plan: InstallmentPlan | null; onDone: () => void }) {
  const { today, savePlan, deletePlan } = useFinance();
  const [name, setName] = useState(plan?.name ?? "");
  const [provider, setProvider] = useState<InstallmentPlan["provider"]>(plan?.provider ?? "tabby");
  const [amount, setAmount] = useState(plan ? String(plan.installment_halalas / 100) : "");
  const [count, setCount] = useState(String(plan?.total_count ?? 4));
  const [firstDue, setFirstDue] = useState(plan?.first_due ?? today);
  const [period, setPeriod] = useState<InstallmentPeriod>(plan?.period ?? "monthly");
  const [paid, setPaid] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const h = parseAmount(amount);
    const n = Number(count);
    const k = Number(paid);
    if (!name.trim()) return setErr("اكتب اسم الطلب أو المتجر");
    if (!h || h <= 0) return setErr("اكتب مبلغ الدفعة");
    if (!Number.isInteger(n) || n < 1 || n > 60) return setErr("عدد الدفعات بين 1 و 60");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return setErr("اختر تاريخ أول دفعة");
    if (!plan && (!Number.isInteger(k) || k < 0 || k > n)) return setErr("المدفوع منها لازم يكون بين 0 وعدد الدفعات");
    setBusy(true);
    const ok = await savePlan({
      id: plan?.id, name: name.trim(), provider, installment_halalas: h, total_count: n, first_due: firstDue, period, active: plan?.active ?? true,
    }, plan ? 0 : k);
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!plan) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deletePlan(plan.id);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Segmented label="الجهة" value={provider} onChange={setProvider} options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} />
      <Field id="p-name" label="الطلب أو المتجر" mode="text" value={name} onChange={setName} placeholder="نون" />
      <div className="grid grid-cols-2 gap-3">
        <Field id="p-amount" label="مبلغ الدفعة (ر.س)" value={amount} onChange={setAmount} />
        <Field id="p-count" label="عدد الدفعات" mode="numeric" value={count} onChange={setCount} />
      </div>
      <div>
        <label htmlFor="p-first" className="mb-1.5 block text-sm">تاريخ أول دفعة</label>
        <input id="p-first" type="date" dir="ltr" value={firstDue} onChange={(e) => setFirstDue(e.target.value)}
          className="w-full rounded-2xl border border-line bg-bg px-4 py-3" />
      </div>
      <Segmented label="التكرار" value={period} onChange={setPeriod} options={PERIODS} />
      {!plan && (
        <Field id="p-paid" label="كم دفعت منها لحد الآن؟" mode="numeric" value={paid} onChange={setPaid}
          hint="لو الخطة بدأت من قبل. تُسجّل الدفعات الأولى مدفوعة." />
      )}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">{busy ? "لحظة…" : "حفظ"}</button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">رجوع</button>
        {plan && (
          <button type="button" onClick={remove} disabled={busy}
            className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
            {confirmDelete ? "تأكيد" : "حذف"}
          </button>
        )}
      </div>
    </form>
  );
}
