"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildAlerts, type SmartAlert } from "@/lib/alerts";
import { computeBalance, type Balance } from "@/lib/balance";
import { summarize, type Summary, type Upcoming } from "@/lib/budget";
import { todayRiyadh } from "@/lib/cycle";
import { dueDateOf, progressOf } from "@/lib/installments";
import { detectRecurring, type Recurring } from "@/lib/recurring";
import { getRepo, type CategoryInput, type CommitmentInput, type GoalInput, type LineInput, type PlanInput, type TxInput } from "@/lib/repo";
import { merchantKey } from "@/lib/sms/normalize";
import { parseSms } from "@/lib/sms/parse";
import type { Category, Commitment, Goal, GoalContribution, InboxItem, InstallmentPayment, InstallmentPlan, Line, Payment, Rule, Settings, Snapshot, Tx } from "@/lib/types";

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
  plans: InstallmentPlan[];
  planPayments: InstallmentPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  summary: Summary;
  balance: Balance;
  alerts: SmartAlert[];
  recurring: Recurring[];
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
  payUpcoming: (u: Upcoming) => Promise<boolean>;
  unpayUpcoming: (u: Upcoming) => Promise<boolean>;
  /** `alreadyPaid` records payments 1..n as paid, for a plan that is already part-way through. */
  savePlan: (p: PlanInput, alreadyPaid?: number) => Promise<boolean>;
  /** A Tabby/Tamara message: pay the plan's next unpaid payment and close the message. */
  payPlanFromInbox: (plan: InstallmentPlan, item: InboxItem) => Promise<boolean>;
  deletePlan: (id: string) => Promise<boolean>;
  saveGoal: (g: GoalInput) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<boolean>;
  addContribution: (goalId: string, amount_halalas: number) => Promise<boolean>;
  deleteContribution: (id: string) => Promise<boolean>;
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
  plans: [], planPayments: [], goals: [], contributions: [],
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

  const payUpcoming: Ctx["payUpcoming"] = (u) => {
    if (u.kind === "commitment" && u.commitment) return pay(u.commitment, summaryCycleStart());
    if (u.plan && u.number) {
      return run(async () => {
        const row = await repo.payInstallment({ plan_id: u.plan!.id, number: u.number!, paid_on: today, amount_halalas: u.plan!.installment_halalas });
        setSnap((p) => ({ ...p, planPayments: [...p.planPayments, row] }));
      });
    }
    return Promise.resolve(false);
  };
  const unpayUpcoming: Ctx["unpayUpcoming"] = (u) => {
    if (u.kind === "commitment" && u.payment) return unpay(u.payment.id);
    if (u.installmentPayment) {
      const id = u.installmentPayment.id;
      return run(async () => { await repo.unpayInstallment(id); setSnap((p) => ({ ...p, planPayments: p.planPayments.filter((x) => x.id !== id) })); });
    }
    return Promise.resolve(false);
  };

  const savePlan: Ctx["savePlan"] = (p, alreadyPaid = 0) =>
    run(async () => {
      const row = await repo.savePlan(p);
      const paid: InstallmentPayment[] = [];
      for (let k = 1; k <= Math.min(alreadyPaid, row.total_count); k++) {
        const due = dueDateOf(row, k - 1);
        paid.push(await repo.payInstallment({ plan_id: row.id, number: k, paid_on: due <= today ? due : today, amount_halalas: row.installment_halalas }));
      }
      setSnap((s) => ({
        ...s,
        plans: [...s.plans.filter((x) => x.id !== row.id), row].sort((a, b) => a.first_due.localeCompare(b.first_due)),
        planPayments: [...s.planPayments, ...paid],
      }));
    });
  const payPlanFromInbox: Ctx["payPlanFromInbox"] = (plan, item) =>
    run(async () => {
      const next = progressOf(plan, snap.planPayments).next;
      if (!next) throw new Error("كل دفعات هذي الخطة مدفوعة");
      await repo.payInstallment({ plan_id: plan.id, number: next.number, paid_on: today, amount_halalas: plan.installment_halalas });
      await repo.resolveInbox(item);
      await reload();
    });
  const deletePlan: Ctx["deletePlan"] = (id) =>
    run(async () => {
      await repo.deletePlan(id);
      setSnap((s) => ({ ...s, plans: s.plans.filter((x) => x.id !== id), planPayments: s.planPayments.filter((x) => x.plan_id !== id) }));
    });
  const saveGoal: Ctx["saveGoal"] = (g) =>
    run(async () => {
      const row = await repo.saveGoal(g);
      setSnap((s) => ({ ...s, goals: [...s.goals.filter((x) => x.id !== row.id), row] }));
    });
  const deleteGoal: Ctx["deleteGoal"] = (id) =>
    run(async () => {
      await repo.deleteGoal(id);
      setSnap((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== id), contributions: s.contributions.filter((x) => x.goal_id !== id) }));
    });
  const addContribution: Ctx["addContribution"] = (goalId, amount) =>
    run(async () => {
      const row = await repo.addContribution({ goal_id: goalId, amount_halalas: amount, on: today });
      setSnap((s) => ({ ...s, contributions: [row, ...s.contributions] }));
    });
  const deleteContribution: Ctx["deleteContribution"] = (id) =>
    run(async () => { await repo.deleteContribution(id); setSnap((s) => ({ ...s, contributions: s.contributions.filter((x) => x.id !== id) })); });

  const summary = useMemo(
    () => summarize({
      today, settings: snap.settings, txs: snap.txs, commitments: snap.commitments,
      payments: snap.payments, lines: snap.lines, categories: snap.categories, plans: snap.plans, planPayments: snap.planPayments,
    }),
    [today, snap],
  );

  const balance = useMemo(
    () => computeBalance({ today, settings: snap.settings, lines: snap.lines, categories: snap.categories, txs: snap.txs }),
    [today, snap],
  );

  const alerts = useMemo(
    () => buildAlerts({ today, settings: snap.settings, categories: snap.categories, txs: snap.txs, summary, balance }),
    [today, snap, summary, balance],
  );
  const recurring = useMemo(() => detectRecurring(snap.txs, today), [snap.txs, today]);

  const summaryCycleStart = () => summary.cycle.start;

  const value: Ctx = {
    status, error, today, ...snap, summary, balance, alerts, recurring, toast, reload,
    saveSettings, saveTx, deleteTx, saveCommitment, deleteCommitment, pay, unpay,
    saveLine, deleteLine, saveCategory, deleteCategory,
    ingestText, classifyInbox, ignoreInbox, recordInbox, learn, payUpcoming, unpayUpcoming,
    savePlan, payPlanFromInbox, deletePlan, saveGoal, deleteGoal, addContribution, deleteContribution,
  };
  return <FinanceCtx.Provider value={value}>{children}</FinanceCtx.Provider>;
}
