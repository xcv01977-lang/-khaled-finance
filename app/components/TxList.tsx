"use client";

import { useFinance } from "@/hooks/useFinance";
import { dayLabel } from "@/lib/format";
import { fmt } from "@/lib/money";
import type { Tx } from "@/lib/types";

export default function TxList({ items, onPick }: { items: Tx[]; onPick: (t: Tx) => void }) {
  const { categories, today } = useFinance();
  if (items.length === 0) return <p className="py-6 text-center text-sm text-mut">ما فيه عمليات لسا. اضغط + وسجّل أول عملية.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        const refund = t.kind === "refund";
        return (
          <li key={t.id}>
            <button onClick={() => onPick(t)} className="flex w-full items-center gap-3 py-3 text-start">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-lg" aria-hidden>{cat?.emoji ?? "📌"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.merchant || cat?.name || "عملية"}</span>
                <span className="block text-xs text-mut">{cat && t.merchant ? `${cat.name} · ` : ""}{dayLabel(t.occurred_on, today)}</span>
              </span>
              <span className={`num font-medium ${refund ? "text-ok" : ""}`}>{refund ? "+" : "−"}{fmt(t.amount_halalas)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
