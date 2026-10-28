"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { dayLabel } from "@/lib/format";
import { fmt } from "@/lib/money";
import type { InboxItem } from "@/lib/types";

const ICON: Record<string, string> = {
  purchase: "🛒", withdrawal: "🏧", refund: "↩️", transfer_out: "💸", installment: "🧾", unknown: "❓",
};
const WHY: Record<string, string> = {
  purchase: "عملية شراء", withdrawal: "سحب", refund: "استرداد", transfer_out: "حوالة صادرة، ما سجلتها لك",
  installment: "دفعة تقسيط، ما سجلتها لك", unknown: "ما قدرت أفهمها",
};
const DONE_LABEL: Record<string, string> = {
  auto: "سُجّلت تلقائياً", done: "راجعتها", ignored: "تجاهلتها", duplicate: "مكررة", review: "تنتظر", unparsed: "بدون مبلغ",
};

export default function InboxSheet({ onClose, onSetup }: { onClose: () => void; onSetup: () => void }) {
  const { inbox, ingestText } = useFinance();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const pending = inbox.filter((i) => i.status === "review" || i.status === "unparsed");
  const recent = inbox.filter((i) => i.status !== "review" && i.status !== "unparsed").slice(0, 8);

  async function paste() {
    if (!text.trim()) return;
    setBusy(true); setResult(null);
    const status = await ingestText(text);
    setBusy(false);
    if (status) {
      setResult(
        status === "review" ? "سجّلتها، وتنتظر تأكيد التصنيف تحت."
          : status === "auto" ? "سجّلتها تلقائياً على تصنيف تعلّمته."
          : status === "duplicate" ? "هذي الرسالة وصلتني قبل شوي، ما كررتها."
          : status === "ignored" ? "رسالة إيداع أو تجاهل، ما سجلتها كمصروف."
          : "وصلت وتنتظر قرارك تحت.",
      );
      setText("");
    }
  }

  return (
    <Sheet open onClose={onClose} title="رسائل البنك">
      <div className="grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="paste" className="text-sm text-mut">الصق رسالة بنك للتجربة، أو لرسالة فاتتك</label>
          <textarea
            id="paste" rows={3} value={text} onChange={(e) => setText(e.target.value)}
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm leading-6"
          />
          <div className="flex items-center gap-2">
            <button onClick={paste} disabled={busy || !text.trim()} className="rounded-2xl bg-acc px-4 py-2.5 text-sm font-semibold text-onacc">
              {busy ? "لحظة…" : "حلّل وسجّل"}
            </button>
            <button onClick={onSetup} className="rounded-2xl bg-soft px-4 py-2.5 text-sm">ربط الاختصار</button>
          </div>
          {result && <p role="status" className="text-sm text-ok">{result}</p>}
        </div>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-mut">
            تنتظر مراجعتك {pending.length > 0 && <span className="num">({pending.length})</span>}
          </h3>
          {pending.length === 0 ? (
            <p className="text-sm text-mut">ما فيه شي ينتظرك.</p>
          ) : (
            pending.map((i) => <PendingCard key={i.id} item={i} />)
          )}
        </section>

        {recent.length > 0 && (
          <section className="grid gap-1">
            <h3 className="text-sm font-semibold text-mut">آخر الرسائل</h3>
            <ul className="divide-y divide-line">
              {recent.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span aria-hidden>{ICON[i.direction] ?? "📩"}</span>
                  <span className="min-w-0 flex-1 truncate">{i.merchant ?? i.bank ?? "رسالة"}</span>
                  {i.amount_halalas != null && <span className="num text-mut">{fmt(i.amount_halalas)}</span>}
                  <span className="rounded-full bg-soft px-2 py-0.5 text-xs text-mut">{DONE_LABEL[i.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function PendingCard({ item }: { item: InboxItem }) {
  const { categories, txs, today, classifyInbox, ignoreInbox, recordInbox } = useFinance();
  const [busy, setBusy] = useState(false);
  const tx = txs.find((t) => t.id === item.transaction_id);
  const recorded = Boolean(tx);
  const canRecord = !recorded && item.amount_halalas != null;

  const run = async (fn: () => Promise<boolean>) => { setBusy(true); await fn(); setBusy(false); };

  return (
    <article className="rounded-2xl bg-bg p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-lg" aria-hidden>{ICON[item.direction] ?? "📩"}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{item.merchant ?? item.bank ?? "رسالة"}</div>
          <div className="text-xs text-mut">
            {[item.bank, item.card_last4 && `بطاقة ${item.card_last4}`, item.occurred_on && dayLabel(item.occurred_on, today)].filter(Boolean).join(" · ")}
          </div>
        </div>
        {item.amount_halalas != null && <span className="num font-medium">{item.direction === "refund" ? "+" : "−"}{fmt(item.amount_halalas)}</span>}
      </div>

      <p className="mt-2 text-xs leading-5 text-mut">
        {recorded ? "سجّلتها لك. اختر التصنيف الصحيح وأتذكره لهالتاجر." : WHY[item.direction] ?? "تنتظر قرارك."}
      </p>

      {(recorded || canRecord) && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={recorded ? "التصنيف" : "سجّلها كمصروف في"}>
          {categories.map((c) => (
            <button
              key={c.id} disabled={busy} aria-pressed={tx?.category_id === c.id}
              onClick={() => run(() => (recorded ? classifyInbox(item, c.id) : recordInbox(item, c.id)))}
              className={`rounded-full px-2.5 py-1 text-xs ${tx?.category_id === c.id ? "bg-acc font-semibold text-onacc" : "bg-soft"}`}
            >
              <span aria-hidden>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <details className="text-xs text-mut">
          <summary className="cursor-pointer">نص الرسالة</summary>
          <p dir="auto" className="mt-1 whitespace-pre-wrap rounded-xl bg-soft p-2 leading-5">{item.raw_text}</p>
        </details>
        <button disabled={busy} onClick={() => run(() => ignoreInbox(item))} className="shrink-0 rounded-full bg-soft px-3 py-1.5 text-xs text-bad">
          {recorded ? "ليست مصروفاً" : "تجاهل"}
        </button>
      </div>
    </article>
  );
}
