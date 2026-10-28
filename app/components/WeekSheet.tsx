"use client";

import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { weeklySummary } from "@/lib/alerts";

export default function WeekSheet({ onClose }: { onClose: () => void }) {
  const f = useFinance();
  const lines = weeklySummary({
    today: f.today, settings: f.settings, categories: f.categories, txs: f.txs, summary: f.summary, balance: f.balance,
  });
  return (
    <Sheet open onClose={onClose} title="ملخص الأسبوع">
      <ul className="grid gap-2.5 text-sm leading-7">
        {lines.map((l, i) => <li key={i} className="rounded-2xl bg-bg px-4 py-3">{l}</li>)}
      </ul>
    </Sheet>
  );
}
