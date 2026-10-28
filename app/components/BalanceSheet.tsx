"use client";

import Sheet from "./Sheet";
import { tone } from "./ui";
import { useFinance } from "@/hooks/useFinance";
import { fmt, fmtSigned } from "@/lib/money";

export default function BalanceSheet({ onClose, onManage }: { onClose: () => void; onManage: () => void }) {
  const { balance, settings, summary } = useFinance();
  const plannedTotal = balance.lines.reduce((s, l) => s + l.planned, 0);
  const unallocated = settings.salary_halalas - plannedTotal - summary.commitmentsTotal;

  return (
    <Sheet open onClose={onClose} title="الميزان">
      <div className="grid gap-4">
        <div className="rounded-2xl bg-bg p-4 text-center">
          <div className="text-sm text-mut">الفائض أو العجز التراكمي</div>
          <div className={`num text-4xl font-medium ${tone(balance.total)}`}>{fmtSigned(balance.total)}</div>
          <div className="mt-1 text-xs text-mut">ر.س · الأخضر فائض والأحمر عجز</div>
        </div>

        {balance.lines.length === 0 ? (
          <div className="grid gap-3 text-center">
            <p className="text-sm leading-7 text-mut">
              قسّم راتبك على بنود (مصاريف، استثمار، طوارئ، أو بنود تضيفها أنت). كل بند يسجّل فائضه أو عجزه
              من دورة لدورة، وما ينتقل فائض بند لبند ثاني.
            </p>
            <button onClick={onManage} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">أضف أول بند</button>
          </div>
        ) : (
          <>
            <ul className="grid gap-2">
              {balance.lines.map((b) => {
                const pct = b.planned > 0 ? Math.min(1, Math.max(0, b.spent / b.planned)) : b.spent > 0 ? 1 : 0;
                return (
                  <li key={b.line.id} className="rounded-2xl bg-bg p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-lg" aria-hidden>{b.line.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{b.line.name}</span>
                        <span className="block text-xs text-mut">
                          صرفت <span className="num">{fmt(b.spent)}</span> من <span className="num">{fmt(b.planned)}</span>
                        </span>
                      </span>
                      <span className="text-end">
                        <span className={`num block text-lg font-medium ${tone(b.effective)}`}>{fmtSigned(b.effective)}</span>
                        <span className="block text-xs text-mut">{b.effective < 0 ? "عجز" : "فائض"}</span>
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      <div className={`h-full rounded-full ${b.remaining < 0 ? "bg-bad" : "bg-acc"}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mut">
                      <span>باقي هالدورة <span className={`num ${tone(b.remaining)}`}>{fmtSigned(b.remaining)}</span></span>
                      <span>من الدورات السابقة <span className={`num ${tone(b.closed)}`}>{fmtSigned(b.closed)}</span></span>
                    </div>
                    {b.coveredFromSurplus && (
                      <p className="mt-2 rounded-xl bg-soft px-3 py-2 text-xs leading-5">
                        تعدّيت خطة هالدورة، وتغطّى العجز من فائضك المتراكم.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {settings.salary_halalas > 0 && (
              <div className="rounded-2xl bg-bg p-3.5 text-sm">
                <div className="mb-2 font-medium">تقسيم الراتب</div>
                <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
                  <dt className="text-mut">الراتب</dt><dd className="num">{fmt(settings.salary_halalas)}</dd>
                  <dt className="text-mut">البنود</dt><dd className="num">−{fmt(plannedTotal)}</dd>
                  <dt className="text-mut">الالتزامات الثابتة</dt><dd className="num">−{fmt(summary.commitmentsTotal)}</dd>
                  <dt className="font-medium">{unallocated < 0 ? "تجاوز الراتب" : "غير موزّع"}</dt>
                  <dd className={`num font-medium ${unallocated < 0 ? "text-bad" : ""}`}>{fmt(unallocated)}</dd>
                </dl>
                {unallocated < 0 && <p className="mt-2 text-xs leading-5 text-bad">مجموع بنودك والتزاماتك أكبر من راتبك.</p>}
              </div>
            )}

            <button onClick={onManage} className="rounded-2xl bg-soft px-4 py-3.5 text-sm">إدارة البنود</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
