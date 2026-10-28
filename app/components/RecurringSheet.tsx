"use client";

import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { fmt } from "@/lib/money";

export default function RecurringSheet({ onClose }: { onClose: () => void }) {
  const { recurring } = useFinance();
  const total = recurring.reduce((s, r) => s + r.monthly, 0);

  return (
    <Sheet open onClose={onClose} title="المتكرر والاشتراكات">
      <div className="grid grid-cols-1 gap-3">
        {recurring.length === 0 ? (
          <p className="text-sm leading-7 text-mut">
            ما لقيت مصاريف متكررة بعد. أكتشفها لما يتكرر نفس المحل 3 مرات على الأقل بنفس الجدول (كل شهر أو كل أسبوع).
            كل ما سجّلت أكثر زادت دقتي.
          </p>
        ) : (
          <>
            <div className="rounded-2xl bg-bg p-3.5 text-center">
              <div className="text-sm text-mut">تكلفتها الشهرية</div>
              <div className="num text-3xl font-medium">{fmt(total)}</div>
              <div className="text-xs text-mut">ر.س على <span className="num">{recurring.length}</span> {recurring.length === 1 ? "بند" : "بنود"}</div>
            </div>
            <ul className="divide-y divide-line">
              {recurring.map((r) => (
                <li key={r.key} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.name}</span>
                    <span className="block text-xs text-mut">
                      {r.period === "monthly" ? "كل شهر" : "كل أسبوع"}{r.variable ? " · يتغير" : ""} · آخر مرة {r.lastDate}
                    </span>
                    {r.status === "rose" && <span className="mt-0.5 block text-xs text-bad">ارتفع <span className="num">+{r.risePct}%</span> (كان <span className="num">{fmt(r.previous!)}</span>)</span>}
                    {r.status === "missing" && <span className="mt-0.5 block text-xs text-acc">ما انسحب هالمرة. ألغيته؟</span>}
                  </span>
                  <span className="num">{fmt(r.last)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
