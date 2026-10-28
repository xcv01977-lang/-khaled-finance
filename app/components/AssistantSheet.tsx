"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";
import { answer, SUGGESTIONS } from "@/lib/assistant";

type Msg = { from: "me" | "bot"; text: string };

export default function AssistantSheet({ onClose }: { onClose: () => void }) {
  const f = useFinance();
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "اسألني عن فلوسك. أجاوب من أرقامك الفعلية، وإذا ما أعرف أقولك." },
  ]);
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    const reply = answer(t, {
      today: f.today, settings: f.settings, categories: f.categories, lines: f.lines,
      txs: f.txs, summary: f.summary, balance: f.balance,
    });
    setMsgs((m) => [...m, { from: "me", text: t }, { from: "bot", text: reply }]);
    setQ("");
  }

  return (
    <Sheet open onClose={onClose} title="اسأل ميزان">
      <div className="grid gap-3">
        <div className="grid max-h-[46dvh] gap-2 overflow-y-auto pe-1" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-7 ${
              m.from === "me" ? "justify-self-start bg-acc text-onacc" : "justify-self-end bg-bg"}`}>
              {m.text}
            </div>
          ))}
          <div ref={end} />
        </div>

        {msgs.length < 3 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="أسئلة مقترحة">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full bg-soft px-3 py-1.5 text-xs">{s}</button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
          <label htmlFor="ask" className="sr-only">سؤالك</label>
          <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="كم صرفت على المطاعم هالشهر؟"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3" autoComplete="off" />
          <button disabled={!q.trim()} className="rounded-2xl bg-acc px-5 font-semibold text-onacc">اسأل</button>
        </form>
        <p className="text-xs leading-5 text-mut">تقدر تستخدم ميكروفون الكيبورد وتسأل بصوتك.</p>
      </div>
    </Sheet>
  );
}
