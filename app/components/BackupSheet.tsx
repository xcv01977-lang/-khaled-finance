"use client";

import { useRef, useState } from "react";
import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { buildExport, exportCounts, parseExport } from "@/lib/export";

export const LAST_BACKUP_KEY = "last-backup";

const stamp = () => new Date().toISOString().slice(0, 10);

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function BackupSheet({ onClose }: { onClose: () => void }) {
  const f = useFinance();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const snapshot = {
    settings: f.settings, categories: f.categories, lines: f.lines, txs: f.txs, commitments: f.commitments,
    payments: f.payments, inbox: f.inbox, rules: f.rules, plans: f.plans, planPayments: f.planPayments,
    goals: f.goals, contributions: f.contributions,
  };
  const counts = exportCounts(buildExport(snapshot).data);
  const [last] = useState(() => { try { return localStorage.getItem(LAST_BACKUP_KEY); } catch { return null; } });

  const remember = () => { try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch {} };

  function saveJson() {
    download(`mizan-${stamp()}.json`, new Blob([JSON.stringify(buildExport(snapshot), null, 2)], { type: "application/json" }));
    remember();
    setMsg({ ok: true, text: "تم تنزيل النسخة. احفظها في مكان ثاني غير الجوال (iCloud أو الكمبيوتر)." });
  }

  async function saveExcel() {
    setBusy(true);
    try {
      const { buildWorkbook } = await import("@/lib/excel");
      const buf = await buildWorkbook(buildExport(snapshot).data);
      download(`mizan-${stamp()}.xlsx`, new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      remember();
      setMsg({ ok: true, text: "تم تنزيل ملف Excel." });
    } catch {
      setMsg({ ok: false, text: "تعذّر إنشاء ملف Excel." });
    }
    setBusy(false);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const parsed = parseExport(await file.text());
    if (!parsed.ok) return setMsg({ ok: false, text: parsed.error });
    setBusy(true);
    const ok = await f.importData(parsed.data);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
    setMsg(ok
      ? { ok: true, text: `تم الاسترجاع: ${parsed.counts.transactions} عملية، ${parsed.counts.lines} بند، ${parsed.counts.commitments} التزام. ما انحذف شي من بياناتك الحالية.` }
      : { ok: false, text: "ما تم الاسترجاع. بياناتك الحالية ما تغيّرت." });
  }

  return (
    <Sheet open onClose={onClose} title="النسخ الاحتياطي">
      <div className="grid grid-cols-1 gap-4">
        <p className="text-sm leading-7 text-mut">
          بياناتك محفوظة على الخادم، لكن الباقة المجانية ما فيها نسخ تلقائي. نزّل نسخة بين فترة وفترة
          (مرة بالشهر كافية)، وهي تكفي لإرجاع كل شي لو تغيّر المشروع.
        </p>
        <div className="rounded-2xl bg-bg p-3.5 text-sm">
          <div className="text-mut">الموجود الآن</div>
          <div className="mt-1 leading-7">
            <span className="num">{counts.transactions}</span> عملية · <span className="num">{counts.lines}</span> بند ·{" "}
            <span className="num">{counts.commitments}</span> التزام · <span className="num">{counts.plans}</span> قسط ·{" "}
            <span className="num">{counts.goals}</span> هدف
          </div>
          <div className="mt-1 text-xs text-mut">
            آخر نسخة نزّلتها من هالجهاز: {last ? new Date(last).toLocaleDateString("ar-u-nu-latn") : "ما نزّلت نسخة بعد"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={saveJson} disabled={busy} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">JSON</button>
          <button onClick={saveExcel} disabled={busy} className="rounded-2xl bg-soft px-4 py-3.5 font-semibold">Excel</button>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="restore" className="text-sm">استرجاع من نسخة JSON</label>
          <input
            id="restore" ref={fileInput} type="file" accept="application/json,.json" disabled={busy}
            onChange={(e) => void restore(e.target.files?.[0])}
            className="text-sm file:me-3 file:rounded-xl file:border-0 file:bg-soft file:px-3 file:py-2 file:text-fg"
          />
          <p className="text-xs leading-5 text-mut">يضيف ويحدّث بدون ما يحذف أي شي موجود. الملف ما يحتوي مفتاح الاختصار، فتسوي مفتاح جديد لو استرجعت على مشروع جديد.</p>
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm leading-6 ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
      </div>
    </Sheet>
  );
}
