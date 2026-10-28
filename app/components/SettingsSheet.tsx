"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { Field, Switch } from "./ui";
import { useFinance } from "@/hooks/useFinance";
import { fmt, parseAmount } from "@/lib/money";
import { IS_DEMO } from "@/lib/repo";
import { getSupabase } from "@/lib/supabase";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";
import type { Commitment } from "@/lib/types";

const asField = (h: number | null) => (h == null ? "" : String(h / 100));

export type SettingsTarget = "lines" | "categories";

export default function SettingsSheet({ onClose, onOpen }: { onClose: () => void; onOpen: (t: SettingsTarget) => void }) {
  const [view, setView] = useState<"main" | "commitment">("main");
  const [editing, setEditing] = useState<Commitment | null>(null);

  return (
    <Sheet open onClose={onClose} title={view === "main" ? "الإعدادات" : editing ? "تعديل التزام" : "التزام جديد"}>
      {view === "main" ? (
        <Main onClose={onClose} onOpen={onOpen} onEdit={(c) => { setEditing(c); setView("commitment"); }} />
      ) : (
        <CommitmentForm editing={editing} onDone={() => setView("main")} />
      )}
    </Sheet>
  );
}

function Main({ onClose, onOpen, onEdit }: { onClose: () => void; onOpen: (t: SettingsTarget) => void; onEdit: (c: Commitment | null) => void }) {
  const { settings, commitments, saveSettings, summary, lines } = useFinance();
  const usesLines = lines.some((l) => l.active && l.counts_daily);
  const [cycleDay, setCycleDay] = useState(String(settings.cycle_day));
  const [shift, setShift] = useState(settings.weekend_shift);
  const [salary, setSalary] = useState(asField(settings.salary_halalas || null));
  const [budget, setBudget] = useState(asField(settings.spending_budget_halalas));
  const [daily, setDaily] = useState(asField(settings.daily_allowance_halalas));
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const day = Number(cycleDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return setErr("يوم الدورة بين 1 و 31");
    const sal = salary.trim() === "" ? 0 : parseAmount(salary);
    const bud = budget.trim() === "" ? null : parseAmount(budget);
    const dai = daily.trim() === "" ? null : parseAmount(daily);
    if (sal === null || bud === undefined || (budget.trim() !== "" && bud === null) || (daily.trim() !== "" && dai === null)) {
      return setErr("تأكد من المبالغ: أرقام فقط وبحد أقصى خانتين بعد الفاصلة");
    }
    setBusy(true);
    const ok = await saveSettings({
      cycle_day: day, weekend_shift: shift, salary_halalas: sal,
      spending_budget_halalas: bud, daily_allowance_halalas: dai,
    });
    setBusy(false);
    if (ok) onClose();
  }

  const pick = (t: Theme) => { applyTheme(t); setThemeState(t); };
  const seg = (on: boolean) =>
    `flex-1 rounded-xl px-3 py-2 text-sm transition ${on ? "bg-acc font-semibold text-onacc" : "bg-soft text-mut"}`;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold text-mut">الراتب والدورة</h3>
        <Field id="salary" label="الراتب الشهري (ر.س)" value={salary} onChange={setSalary} placeholder="0" />
        <div className="grid grid-cols-[7rem_1fr] items-end gap-3">
          <Field id="cycleDay" label="يوم الراتب" mode="numeric" value={cycleDay} onChange={setCycleDay} />
          <Switch checked={shift} onChange={setShift}>الجمعة ← الخميس والسبت ← الأحد</Switch>
        </div>
      </section>

      <section className="grid gap-4">
        <h3 className="text-sm font-semibold text-mut">المصروف</h3>
        <Field id="budget" label="ميزانية المصروف للدورة (ر.س)" value={budget} onChange={setBudget}
          hint={usesLines ? "عندك بنود يومية، فالميزانية تؤخذ من مجموعها وهذا الحقل ما يؤثر." : `اتركها فاضية وأحسبها لك: الراتب ناقص الالتزامات${settings.salary_halalas ? ` = ${fmt(Math.max(0, settings.salary_halalas - summary.commitmentsTotal))} ر.س` : ""}.`} />
        <Field id="daily" label="المخصص اليومي (ر.س)" value={daily} onChange={setDaily}
          hint="اتركه فاضي وأقسم الميزانية على أيام الدورة." />
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold text-mut">تقسيم الراتب</h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onOpen("lines")} className="rounded-2xl bg-soft px-4 py-3 text-start text-sm">📂 البنود</button>
          <button type="button" onClick={() => onOpen("categories")} className="rounded-2xl bg-soft px-4 py-3 text-start text-sm">🏷️ التصنيفات</button>
        </div>
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mut">الالتزامات الثابتة</h3>
          <button type="button" onClick={() => onEdit(null)} className="rounded-full bg-soft px-3 py-1 text-sm">＋ أضف</button>
        </div>
        {commitments.length === 0 ? (
          <p className="text-sm leading-6 text-mut">إيجار، أقساط، اشتراكات. تنخصم من الراتب قبل ما أحسب مصروفك اليومي.</p>
        ) : (
          <ul className="divide-y divide-line">
            {commitments.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onEdit(c)} className="flex w-full items-center gap-3 py-3 text-start">
                  <span aria-hidden>{c.emoji}</span>
                  <span className="flex-1">
                    {c.name}
                    <span className="block text-xs text-mut">يوم <span className="num">{c.due_day}</span> من كل شهر{c.active ? "" : " · موقوف"}</span>
                  </span>
                  <span className="num">{fmt(c.amount_halalas)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold text-mut">المظهر</h3>
        <div className="flex gap-2" role="group" aria-label="المظهر">
          <button type="button" aria-pressed={theme === "dark"} onClick={() => pick("dark")} className={seg(theme === "dark")}>ليلي</button>
          <button type="button" aria-pressed={theme === "light"} onClick={() => pick("light")} className={seg(theme === "light")}>نهاري</button>
          <button type="button" aria-pressed={theme === "system"} onClick={() => pick("system")} className={seg(theme === "system")}>تلقائي</button>
        </div>
      </section>

      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">
          {busy ? "لحظة…" : "حفظ"}
        </button>
        {!IS_DEMO && (
          <button type="button" onClick={() => void getSupabase().auth.signOut()} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">
            خروج
          </button>
        )}
      </div>
    </div>
  );
}

function CommitmentForm({ editing, onDone }: { editing: Commitment | null; onDone: () => void }) {
  const { saveCommitment, deleteCommitment } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [emoji, setEmoji] = useState(editing?.emoji ?? "📌");
  const [amount, setAmount] = useState(editing ? String(editing.amount_halalas / 100) : "");
  const [day, setDay] = useState(editing ? String(editing.due_day) : "1");
  const [active, setActive] = useState(editing?.active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const h = parseAmount(amount);
    const d = Number(day);
    if (!name.trim()) return setErr("اكتب اسم الالتزام");
    if (!h || h <= 0) return setErr("اكتب مبلغ صحيح");
    if (!Number.isInteger(d) || d < 1 || d > 31) return setErr("يوم الاستحقاق بين 1 و 31");
    setBusy(true);
    const ok = await saveCommitment({ id: editing?.id, name: name.trim(), emoji: emoji.trim() || "📌", amount_halalas: h, due_day: d, active });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deleteCommitment(editing.id);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div>
          <label htmlFor="c-emoji" className="mb-1.5 block text-sm">رمز</label>
          <input id="c-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4}
            className="w-full rounded-2xl border border-line bg-bg px-3 py-3 text-center text-xl" />
        </div>
        <div>
          <label htmlFor="c-name" className="mb-1.5 block text-sm">الاسم</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="الإيجار"
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3" />
        </div>
      </div>
      <Field id="c-amount" label="المبلغ (ر.س)" value={amount} onChange={setAmount} />
      <Field id="c-day" label="يوم الاستحقاق من الشهر" mode="numeric" value={day} onChange={setDay}
        hint="لو الشهر أقصر من اليوم المحدد (31 مثلاً) يُحسب آخر يوم فيه." />
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[var(--acc)]" />
        فعّال
      </label>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">{busy ? "لحظة…" : "حفظ"}</button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">رجوع</button>
        {editing && (
          <button type="button" onClick={remove} disabled={busy}
            className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
            {confirmDelete ? "تأكيد" : "حذف"}
          </button>
        )}
      </div>
    </form>
  );
}
