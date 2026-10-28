"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { Field, Segmented, Switch } from "./ui";
import { plannedFor, withPlan } from "@/lib/balance";
import { fmt, parseAmount, parseSigned } from "@/lib/money";
import { useFinance } from "@/hooks/useFinance";
import type { Line, LineKind } from "@/lib/types";

const KINDS: { value: LineKind; label: string; emoji: string; daily: boolean }[] = [
  { value: "expenses", label: "مصاريف", emoji: "💸", daily: true },
  { value: "investment", label: "استثمار", emoji: "📈", daily: false },
  { value: "emergency", label: "طوارئ", emoji: "🛟", daily: false },
  { value: "custom", label: "بند آخر", emoji: "📌", daily: false },
];

export default function LinesSheet({ onClose }: { onClose: () => void }) {
  const { lines, balance } = useFinance();
  const [editing, setEditing] = useState<Line | "new" | null>(null);

  return (
    <Sheet open onClose={onClose} title={editing === null ? "البنود" : editing === "new" ? "بند جديد" : "تعديل بند"}>
      {editing === null ? (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-mut">
            كل بند له مبلغ شهري وفائض متراكم خاص فيه. فائض أي بند ما ينضاف تلقائياً لبند ثاني.
          </p>
          {lines.length > 0 && (
            <ul className="divide-y divide-line">
              {[...lines].sort((a, b) => a.sort - b.sort).map((l) => {
                const planned = balance.lines.find((x) => x.line.id === l.id)?.planned ?? plannedFor(l, balance.cycle.start);
                return (
                  <li key={l.id}>
                    <button onClick={() => setEditing(l)} className="flex w-full items-center gap-3 py-3 text-start">
                      <span aria-hidden>{l.emoji}</span>
                      <span className="flex-1">
                        {l.name}
                        <span className="block text-xs text-mut">
                          {l.counts_daily ? "يحسب في المسموح اليوم" : "ما يدخل في المسموح اليوم"}{l.active ? "" : " · موقوف"}
                        </span>
                      </span>
                      <span className="num">{fmt(planned)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button onClick={() => setEditing("new")} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">＋ أضف بند</button>
        </div>
      ) : (
        <LineForm line={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}
    </Sheet>
  );
}

function LineForm({ line, onDone }: { line: Line | null; onDone: () => void }) {
  const { lines, balance, saveLine, deleteLine } = useFinance();
  const cycleStart = balance.cycle.start;
  const currentPlan = line ? plannedFor(line, cycleStart) : 0;

  const [kind, setKind] = useState<LineKind>(line?.kind ?? "expenses");
  const [name, setName] = useState(line?.name ?? "");
  const [emoji, setEmoji] = useState(line?.emoji ?? "💸");
  const [planned, setPlanned] = useState(line ? String(currentPlan / 100) : "");
  const [opening, setOpening] = useState(line && line.opening_halalas !== 0 ? String(line.opening_halalas / 100) : "");
  const [daily, setDaily] = useState(line?.counts_daily ?? true);
  const [active, setActive] = useState(line?.active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function pickKind(k: LineKind) {
    setKind(k);
    const meta = KINDS.find((x) => x.value === k)!;
    if (!line) {
      setDaily(meta.daily);
      if (!name || KINDS.some((x) => x.label === name)) setName(meta.label);
      setEmoji(meta.emoji);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(planned);
    const open = opening.trim() === "" ? 0 : parseSigned(opening);
    if (!name.trim()) return setErr("اكتب اسم البند");
    if (amount === null) return setErr("اكتب المبلغ الشهري للبند (0 مقبول)");
    if (open === null) return setErr("الرصيد الافتتاحي رقم صحيح، ويقبل علامة ناقص");

    const plans = line
      ? amount === currentPlan ? line.plans : withPlan(line.plans, cycleStart, amount)
      : [{ from: cycleStart, amount_halalas: amount }];

    setBusy(true);
    const ok = await saveLine({
      id: line?.id, name: name.trim(), emoji: emoji.trim() || "📌", kind, counts_daily: daily,
      plans, opening_halalas: open, tracking_start: line?.tracking_start ?? cycleStart,
      sort: line?.sort ?? lines.reduce((m, l) => Math.max(m, l.sort), -1) + 1, active,
    });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!line) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deleteLine(line.id);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Segmented label="نوع البند" value={kind} onChange={pickKind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div>
          <label htmlFor="l-emoji" className="mb-1.5 block text-sm">رمز</label>
          <input id="l-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4}
            className="w-full rounded-2xl border border-line bg-bg px-3 py-3 text-center text-xl" />
        </div>
        <Field id="l-name" label="الاسم" mode="text" value={name} onChange={setName} />
      </div>
      <Field id="l-planned" label="المبلغ الشهري (ر.س)" value={planned} onChange={setPlanned}
        hint={line ? "التعديل يسري من هالدورة، والدورات اللي سكّرت تبقى بخطتها القديمة." : undefined} />
      <Field id="l-opening" label="رصيد افتتاحي (اختياري)" value={opening} onChange={setOpening}
        hint="فائض أو عجز سابق تبي تبدأ منه. عجز اكتبه بعلامة ناقص، مثل -300." />
      <Switch checked={daily} onChange={setDaily}>يدخل في «تقدر تصرف اليوم»</Switch>
      {line && <Switch checked={active} onChange={setActive}>البند فعّال</Switch>}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">{busy ? "لحظة…" : "حفظ"}</button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">رجوع</button>
        {line && (
          <button type="button" onClick={remove} disabled={busy}
            className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
            {confirmDelete ? "تأكيد" : "حذف"}
          </button>
        )}
      </div>
      {confirmDelete && <p className="text-xs leading-5 text-mut">حذف البند يمسح فائضه المتراكم نهائياً. لو تبي توقفه بس، عطّل «البند فعّال».</p>}
    </form>
  );
}
