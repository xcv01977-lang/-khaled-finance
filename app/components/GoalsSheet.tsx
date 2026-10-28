"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { Field } from "./ui";
import { useFinance } from "@/hooks/useFinance";
import { monthLabel } from "@/lib/format";
import { goalStatus } from "@/lib/goals";
import { fmt, parseAmount } from "@/lib/money";
import type { Goal } from "@/lib/types";

export default function GoalsSheet({ onClose }: { onClose: () => void }) {
  const { goals, contributions, today } = useFinance();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  return (
    <Sheet open onClose={onClose} title={editing === null ? "الأهداف" : editing === "new" ? "هدف جديد" : "تعديل هدف"}>
      {editing === null ? (
        <div className="grid grid-cols-1 gap-3">
          {goals.length === 0 && (
            <p className="text-sm leading-7 text-mut">حدّد هدف ادخار (سفر، سيارة، صندوق طوارئ) وأحسب لك متى توصله بمعدلك الحالي وش تغيّر عشان توصل أسرع.</p>
          )}
          {goals.map((g) => <GoalCard key={g.id} goal={g} contributions={contributions} today={today} onEdit={() => setEditing(g)} />)}
          <button onClick={() => setEditing("new")} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">＋ أضف هدف</button>
        </div>
      ) : (
        <GoalForm goal={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}
    </Sheet>
  );
}

function GoalCard({ goal, contributions, today, onEdit }: { goal: Goal; contributions: ReturnType<typeof useFinance>["contributions"]; today: string; onEdit: () => void }) {
  const { addContribution } = useFinance();
  const st = goalStatus(goal, contributions, today);
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function put(sign: 1 | -1) {
    const h = parseAmount(amount);
    if (!h) return setErr("اكتب مبلغ صحيح");
    if (sign < 0 && h > st.saved) return setErr("المبلغ أكبر من اللي ادخرته");
    setErr(null);
    if (await addContribution(goal.id, sign * h)) setAmount("");
  }

  return (
    <article className="min-w-0 rounded-2xl bg-bg p-3.5">
      <button onClick={onEdit} className="flex w-full items-center gap-3 text-start" aria-label={`تعديل ${goal.name}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-xl" aria-hidden>{goal.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{goal.name}</span>
          <span className="block text-xs text-mut"><span className="num">{fmt(st.saved)}</span> من <span className="num">{fmt(goal.target_halalas)}</span> ر.س</span>
        </span>
        <span className="num text-lg font-medium">{Math.round(st.pct * 100)}%</span>
      </button>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${st.done ? "bg-ok" : "bg-acc"}`} style={{ width: `${st.pct * 100}%`, transition: "width .6s" }} />
      </div>

      <div className="mt-3 grid gap-1.5 text-sm leading-6">
        {st.done ? (
          <p className="text-ok">🎉 وصلت هدفك.</p>
        ) : st.rate === null ? (
          <p className="text-mut">أضف مبلغ أو حدّد مبلغ شهري في تعديل الهدف، وأحسب لك متى توصل.</p>
        ) : (
          <>
            <p>
              بمعدل <span className="num">{fmt(st.rate)}</span> ر.س شهرياً{st.rateSource === "history" ? " (من ادخارك الفعلي)" : ""} توصل بعد{" "}
              <b className="num">{st.etaMonths}</b> {st.etaMonths === 1 ? "شهر" : "أشهر"}، تقريباً {monthLabel(st.etaDate!)}.
            </p>
            {st.boost && (
              <p className="text-acc-text">
                لو زدت <span className="num">{fmt(st.boost.extra)}</span> ر.س شهرياً توصل بعد <span className="num">{st.boost.months}</span> أشهر،
                يعني توفّر <span className="num">{st.boost.saves}</span> {st.boost.saves === 1 ? "شهر" : "أشهر"}.
              </p>
            )}
          </>
        )}
        {st.neededMonthly !== null && (
          <p className={st.onTrack === false ? "text-bad" : st.onTrack ? "text-ok" : "text-mut"}>
            عشان توصل قبل {monthLabel(goal.deadline!)} تحتاج <span className="num">{fmt(st.neededMonthly)}</span> ر.س شهرياً
            {st.onTrack === true ? ". أنت ماشي صح." : st.onTrack === false ? ". معدلك الحالي أقل." : "."}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor={`add-${goal.id}`} className="sr-only">مبلغ</label>
        <input id={`add-${goal.id}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" placeholder="المبلغ"
          className="num w-0 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-start text-sm" />
        <button onClick={() => put(1)} className="shrink-0 rounded-xl bg-acc px-3 py-2 text-sm font-semibold text-onacc">＋ أضف</button>
        <button onClick={() => put(-1)} className="shrink-0 rounded-xl bg-soft px-3 py-2 text-sm">− اسحب</button>
      </div>
      {err && <p role="alert" className="mt-1.5 text-xs text-bad">{err}</p>}
    </article>
  );
}

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const { today, saveGoal, deleteGoal } = useFinance();
  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [target, setTarget] = useState(goal ? String(goal.target_halalas / 100) : "");
  const [monthly, setMonthly] = useState(goal?.monthly_halalas ? String(goal.monthly_halalas / 100) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const t = parseAmount(target);
    const m = monthly.trim() === "" ? null : parseAmount(monthly);
    if (!name.trim()) return setErr("اكتب اسم الهدف");
    if (!t || t <= 0) return setErr("اكتب المبلغ المطلوب");
    if (monthly.trim() !== "" && (!m || m <= 0)) return setErr("المبلغ الشهري رقم صحيح أو اتركه فاضي");
    setBusy(true);
    const ok = await saveGoal({
      id: goal?.id, name: name.trim(), emoji: emoji.trim() || "🎯", target_halalas: t, monthly_halalas: m,
      deadline: deadline || null, created_on: goal?.created_on ?? today,
    });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!goal) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deleteGoal(goal.id);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div>
          <label htmlFor="g-emoji" className="mb-1.5 block text-sm">رمز</label>
          <input id="g-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4}
            className="w-full rounded-2xl border border-line bg-bg px-3 py-3 text-center text-xl" />
        </div>
        <Field id="g-name" label="اسم الهدف" mode="text" value={name} onChange={setName} placeholder="سفر الصيف" />
      </div>
      <Field id="g-target" label="المبلغ المطلوب (ر.س)" value={target} onChange={setTarget} />
      <Field id="g-monthly" label="كم تبي تدخر شهرياً؟ (اختياري)" value={monthly} onChange={setMonthly}
        hint="لو تركته فاضي أحسب معدلك من اللي تضيفه فعلياً." />
      <div>
        <label htmlFor="g-deadline" className="mb-1.5 block text-sm">موعد تبي توصل فيه (اختياري)</label>
        <input id="g-deadline" type="date" dir="ltr" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="w-full rounded-2xl border border-line bg-bg px-4 py-3" />
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">{busy ? "لحظة…" : "حفظ"}</button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">رجوع</button>
        {goal && (
          <button type="button" onClick={remove} disabled={busy}
            className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
            {confirmDelete ? "تأكيد" : "حذف"}
          </button>
        )}
      </div>
      {confirmDelete && <p className="text-xs leading-5 text-mut">الحذف يمسح كل المبالغ اللي سجلتها لهذا الهدف.</p>}
    </form>
  );
}
