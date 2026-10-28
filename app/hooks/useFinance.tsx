"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeBalance, type Balance } from "@/lib/balance";
import { summarize, type Summary } from "@/lib/budget";
import { todayRiyadh } from "@/lib/cycle";
import { getRepo, type CategoryInput, type CommitmentInput, type LineInput, type TxInput } from "@/lib/repo";
import { merchantKey } from "@/lib/sms/normalize";
import { parseSms } from "@/lib/sms/parse";
import type { Category, Commitment, InboxItem, Line, Payment, Rule, Settings, Snapshot, Tx } from "@/lib/types";

type Status = "loading" | "ready" | "error";

type Ctx = {
  status: Status;
  error: string | null;
  today: string;
  settings: Settings;
  categories: Category[];
  lines: Line[];
  txs: Tx[];
  commitments: Commitment[];
  payments: Payment[];
  inbox: InboxItem[];
  rules: Rule[];
  summary: Summary;
  balance: Balance;
  toast: string | null;
  reload: () => Promise<void>;
  saveSettings: (s: Settings) => Promise<boolean>;
  saveTx: (t: TxInput) => Promise<boolean>;
  deleteTx: (id: string) => Promise<boolean>;
  saveCommitment: (c: CommitmentInput) => Promise<boolean>;
  deleteCommitment: (id: string) => Promise<boolean>;
  pay: (c: Commitment, cycleStart: string) => Promise<boolean>;
  unpay: (id: string) => Promise<boolean>;
  saveLine: (l: LineInput) => Promise<boolean>;
  deleteLine: (id: string) => Promise<boolean>;
  saveCategory: (c: CategoryInput) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  ingestText: (raw: string) => Promise<string | null>;
  classifyInbox: (item: InboxItem, categoryId: string) => Promise<boolean>;
  ignoreInbox: (item: InboxItem) => Promise<boolean>;
  recordInbox: (item: InboxItem, categoryId: string | null) => Promise<boolean>;
  learn: (merchant: string | null, categoryId: string | null) => Promise<void>;
};

const FinanceCtx = createContext<Ctx | null>(null);

export const useFinance = () => {
  const v = useContext(FinanceCtx);
  if (!v) throw new Error("useFinance must be used inside FinanceProvider");
  return v;
};

const EMPTY: Snapshot = {
  settings: { cycle_day: 27, weekend_shift: true, salary_halalas: 0, spending_budget_halalas: null, daily_allowance_halalas: null, ingest_token_hash: null },
  categories: [], lines: [], txs: [], commitments: [], payments: [], inbox: [], rules: [],
};

const sortTxs = (txs: Tx[]) => [...txs].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

export function FinanceProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepo(), []);
  const [today, setToday] = useState(() => todayRiyadh());
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      setSnap(await repo.load(todayRiyadh()));
      setStatus("ready");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تحميل البيانات");
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, [repo]);

  useEffect(() => {
    let alive = true;
    repo.load(todayRiyadh()).then(
      (s) => { if (alive) { setSnap(s); setStatus("ready"); setError(null); } },
      (e) => { if (alive) { setError(e instanceof Error ? e.message : "تعذّر تحميل البيانات"); setStatus("error"); } },
    );
    return () => { alive = false; };
  }, [repo]);

  // Keep "today" correct when the app stays open past midnight or returns from the background.
  useEffect(() => {
    const tick = () => setToday((t) => { const n = todayRiyadh(); return n === t ? t : n; });
    const id = setInterval(tick, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") { tick(); void reload(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [reload]);

  // Every write goes to the server first and the screen only changes after it succeeds.
  const run = useCallback(async (fn: () => Promise<void>) => {
    try { await fn(); return true; }
    catch (e) { notify(e instanceof Error ? e.message : "ما انحفظ، حاول مرة ثانية"); return false; }
  }, [notify]);

  const saveSettings: Ctx["saveSettings"] = (s) =>
    run(async () => { const settings = await repo.saveSettings(s); setSnap((p) => ({ ...p, settings })); });

  const saveTx: Ctx["saveTx"] = (t) =>
    run(async () => {
      const row = await repo.saveTx(t);
      setSnap((p) => ({ ...p, txs: sortTxs([row, ...p.txs.filter((x) => x.id !== row.id)]) }));
    });

  const deleteTx: Ctx["deleteTx"] = (id) =>
    run(async () => { await repo.deleteTx(id); setSnap((p) => ({ ...p, txs: p.txs.filter((x) => x.id !== id) })); });

  const saveCommitment: Ctx["saveCommitment"] = (c) =>
    run(async () => {
      const row = await repo.saveCommitment(c);
      setSnap((p) => ({ ...p, commitments: [...p.commitments.filter((x) => x.id !== row.id), row].sort((a, b) => a.due_day - b.due_day) }));
    });

  const deleteCommitment: Ctx["deleteCommitment"] = (id) =>
    run(async () => {
      await repo.deleteCommitment(id);
      setSnap((p) => ({
        ...p,
        commitments: p.commitments.filter((x) => x.id !== id),
        payments: p.payments.filter((x) => x.commitment_id !== id),
      }));
    });

  const pay: Ctx["pay"] = (c, cycleStart) =>
    run(async () => {
      const row = await repo.pay({ commitment_id: c.id, cycle_start: cycleStart, paid_on: today, amount_halalas: c.amount_halalas });
      setSnap((p) => ({ ...p, payments: [...p.payments, row] }));
    });

  const unpay: Ctx["unpay"] = (id) =>
    run(async () => { await repo.unpay(id); setSnap((p) => ({ ...p, payments: p.payments.filter((x) => x.id !== id) })); });

  const saveLine: Ctx["saveLine"] = (l) =>
    run(async () => {
      const row = await repo.saveLine(l);
      setSnap((p) => ({ ...p, lines: [...p.lines.filter((x) => x.id !== row.id), row].sort((a, b) => a.sort - b.sort) }));
    });

  const deleteLine: Ctx["deleteLine"] = (id) =>
    run(async () => {
      await repo.deleteLine(id);
      setSnap((p) => ({
        ...p,
        lines: p.lines.filter((x) => x.id !== id),
        categories: p.categories.map((c) => (c.line_id === id ? { ...c, line_id: null } : c)),
      }));
    });

  const saveCategory: Ctx["saveCategory"] = (c) =>
    run(async () => {
      const row = await repo.saveCategory(c);
      setSnap((p) => ({ ...p, categories: [...p.categories.filter((x) => x.id !== row.id), row].sort((a, b) => a.sort - b.sort) }));
    });

  const deleteCategory: Ctx["deleteCategory"] = (id) =>
    run(async () => {
      await repo.deleteCategory(id);
      setSnap((p) => ({
        ...p,
        categories: p.categories.filter((x) => x.id !== id),
        txs: p.txs.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)),
      }));
    });

  const ingestText: Ctx["ingestText"] = async (raw) => {
    const parsed = parseSms(raw, { today });
    if (parsed.amount_halalas === null) { notify("ما لقيت مبلغ في الرسالة"); return null; }
    let status: string | null = null;
    const ok = await run(async () => { status = (await repo.ingest(raw, parsed)).status; await reload(); });
    return ok ? status : null;
  };

  const classifyInbox: Ctx["classifyInbox"] = (item, categoryId) =>
    run(async () => { await repo.classifyInbox(item, categoryId); await reload(); });
  const ignoreInbox: Ctx["ignoreInbox"] = (item) =>
    run(async () => { await repo.ignoreInbox(item); await reload(); });
  const recordInbox: Ctx["recordInbox"] = (item, categoryId) =>
    run(async () => { await repo.recordInbox(item, categoryId); await reload(); });

  // A correction on a transaction becomes a rule, so the same merchant lands right next time.
  const learn: Ctx["learn"] = async (merchant, categoryId) => {
    const key = merchantKey(merchant);
    if (!key || !categoryId) return;
    await run(async () => {
      await repo.saveRule(key, categoryId);
      setSnap((p) => ({
        ...p,
        rules: p.rules.some((r) => r.merchant_key === key)
          ? p.rules.map((r) => (r.merchant_key === key ? { ...r, category_id: categoryId, ignore: false } : r))
          : [...p.rules, { id: `local-${key}`, merchant_key: key, category_id: categoryId, ignore: false, hits: 0 }],
      }));
    });
  };

  const summary = useMemo(
    () => summarize({
      today, settings: snap.settings, txs: snap.txs, commitments: snap.commitments,
      payments: snap.payments, lines: snap.lines, categories: snap.categories,
    }),
    [today, snap],
  );

  const balance = useMemo(
    () => computeBalance({ today, settings: snap.settings, lines: snap.lines, categories: snap.categories, txs: snap.txs }),
    [today, snap],
  );

  const value: Ctx = {
    status, error, today, ...snap, summary, balance, toast, reload,
    saveSettings, saveTx, deleteTx, saveCommitment, deleteCommitment, pay, unpay,
    saveLine, deleteLine, saveCategory, deleteCategory,
    ingestText, classifyInbox, ignoreInbox, recordInbox, learn,
  };
  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}
