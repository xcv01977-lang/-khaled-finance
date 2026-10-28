"use client";

import { useState } from "react";
import AddTxSheet from "./AddTxSheet";
import BalanceSheet from "./BalanceSheet";
import CategoriesSheet from "./CategoriesSheet";
import Gauge from "./Gauge";
import LinesSheet from "./LinesSheet";
import SettingsSheet from "./SettingsSheet";
import TxList from "./TxList";
import TxListSheet from "./TxListSheet";
import { useFinance } from "@/hooks/useFinance";
import { inDaysLabel } from "@/lib/format";
import { tone } from "./ui";
import { fmt, fmtSigned } from "@/lib/money";
import type { Tx } from "@/lib/types";

type Open =
  | null
  | { sheet: "add"; tx?: Tx }
  | { sheet: "list" }
  | { sheet: "settings" }
  | { sheet: "balance" }
  | { sheet: "lines" }
  | { sheet: "categories" };

export default function Home() {
  const f = useFinance();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  if (f.status === "loading") return <div className="grid min-h-dvh place-items-center text-mut">لحظة…</div>;
  if (f.status === "error")
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm place-content-center gap-4 px-6 text-center">
        <p className="text-bad" role="alert">{f.error}</p>
        <button onClick={() => void f.reload()} className="rounded-2xl bg-acc px-4 py-3 font-semibold text-onacc">حاول مرة ثانية</button>
      </main>
    );

  const { summary: s, settings } = f;
  const configured = settings.salary_halalas > 0 || settings.spending_budget_halalas != null;
  const recent = f.txs.filter((t) => t.occurred_on >= s.cycle.start && t.occurred_on <= s.cycle.end).slice(0, 5);
  const unpaid = s.upcoming.filter((u) => u.status !== "paid");
  const hasOverdue = s.upcoming.some((u) => u.status === "overdue");
  const forecastTone = !configured ? "" : s.projectedSurplus < 0 ? "text-bad" : "text-ok";

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-4 lg:max-w-4xl lg:px-8">
      <header className="mb-4 flex items-center justify-between text-sm text-mut">
        <div>
          الدورة · اليوم <span className="num">{s.cycle.day}</span> من <span className="num">{s.cycle.length}</span>
          <span className="block text-xs">باقي <span className="num">{s.cycle.daysLeft}</span> يوم على الراتب</span>
        </div>
        <button onClick={() => setOpen({ sheet: "settings" })} aria-label="الإعدادات" className="grid h-10 w-10 place-items-center rounded-full bg-card">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <section className="grid content-start gap-4">
          <Gauge allowed={s.allowedToday} daily={s.dailyBudget} configured={configured} />

          {!configured && (
            <button onClick={() => setOpen({ sheet: "settings" })} className="rounded-2xl border border-acc p-4 text-start leading-7">
              <b>ابدأ من هنا.</b> حدد راتبك والتزاماتك الثابتة عشان أحسب لك كم تقدر تصرف كل يوم.
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-card p-3.5 text-sm text-mut">
              توقع نهاية الدورة
              <b className={`num mt-1 block text-xl font-medium ${forecastTone || "text-fg"}`}>{configured ? fmtSigned(s.projectedSurplus) : "—"}</b>
            </div>
            <div className="rounded-2xl bg-card p-3.5 text-sm text-mut">
              صرفت هالدورة
              <b className="num mt-1 block text-xl font-medium text-fg">{fmt(s.spent)}</b>
              {configured && <span className="text-xs">من <span className="num">{fmt(s.pool)}</span></span>}
            </div>
          </div>

          <button onClick={() => setOpen({ sheet: "balance" })} className="flex items-center justify-between rounded-2xl bg-card p-3.5 text-start text-sm text-mut">
            <span>
              الميزان التراكمي
              <span className="block text-xs">{f.balance.lines.length ? "فائض أو عجز بنودك" : "قسّم راتبك على بنود"}</span>
            </span>
            <b className={`num text-xl font-medium ${tone(f.balance.total)}`}>
              {f.balance.lines.length ? fmtSigned(f.balance.total) : "＋"}
            </b>
          </button>

          {s.alerts.map((a) => (
            <div key={a.id} role="status"
              className={`rounded-2xl border p-3.5 text-sm leading-6 ${a.tone === "bad" ? "border-bad text-bad" : "border-acc"}`}>
              {a.text}
            </div>
          ))}
        </section>

        <section className="grid content-start gap-4">
          <details open={hasOverdue} className="rounded-2xl bg-card px-4">
            <summary className="flex cursor-pointer items-center justify-between py-3.5 font-medium">
              <span>
                المدفوعات القادمة
                {unpaid.length > 0 && <span className="ms-2 text-sm text-mut"><span className="num">{fmt(s.commitmentsLeft)}</span> ر.س</span>}
              </span>
              <span className="chev text-mut transition-transform" aria-hidden>⌄</span>
            </summary>
            {s.upcoming.length === 0 ? (
              <p className="pb-4 text-sm leading-6 text-mut">
                ما أضفت التزامات. أضفها من <button className="underline" onClick={() => setOpen({ sheet: "settings" })}>الإعدادات</button>.
              </p>
            ) : (
              <ul className="divide-y divide-line pb-1">
                {s.upcoming.map((u) => (
                  <li key={u.commitment.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-lg" aria-hidden>{u.commitment.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${u.status === "paid" ? "text-mut line-through" : ""}`}>{u.commitment.name}</span>
                      <span className={`block text-xs ${u.status === "overdue" ? "text-bad" : u.status === "today" ? "text-acc" : "text-mut"}`}>
                        {u.status === "paid" ? "مدفوعة" : inDaysLabel(u.inDays)}
                      </span>
                    </span>
                    <span className="num">{fmt(u.commitment.amount_halalas)}</span>
                    {u.status === "paid" ? (
                      <button onClick={() => u.payment && void f.unpay(u.payment.id)} className="rounded-full bg-soft px-3 py-1.5 text-xs text-mut">تراجع</button>
                    ) : (
                      <button onClick={() => void f.pay(u.commitment, s.cycle.start)} className="rounded-full bg-soft px-3 py-1.5 text-xs">دفعت</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>

          <div className="rounded-2xl bg-card px-4 pb-1 pt-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">آخر العمليات</h2>
              {recent.length > 0 && (
                <button onClick={() => setOpen({ sheet: "list" })} className="text-sm text-mut">عرض الكل</button>
              )}
            </div>
            <TxList items={recent} onPick={(tx) => setOpen({ sheet: "add", tx })} />
          </div>
        </section>
      </div>

      <button
        onClick={() => setOpen({ sheet: "add" })} aria-label="إضافة عملية"
        className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] start-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-acc text-onacc shadow-[0_10px_24px_-8px_var(--acc)] transition active:scale-95 lg:start-[max(2rem,calc(50vw-28rem))]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {open?.sheet === "add" && <AddTxSheet editing={open.tx} onClose={close} />}
      {open?.sheet === "list" && <TxListSheet onClose={close} onPick={(tx) => setOpen({ sheet: "add", tx })} />}
      {open?.sheet === "settings" && <SettingsSheet onClose={close} onOpen={(t) => setOpen({ sheet: t })} />}
      {open?.sheet === "balance" && <BalanceSheet onClose={close} onManage={() => setOpen({ sheet: "lines" })} />}
      {open?.sheet === "lines" && <LinesSheet onClose={close} />}
      {open?.sheet === "categories" && <CategoriesSheet onClose={close} />}

      {f.toast && (
        <div role="alert" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl bg-bad px-4 py-3 text-center text-sm text-white shadow-lg">
          {f.toast}
        </div>
      )}
    </main>
  );
}
