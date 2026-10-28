import { addDays } from "./cycle";
import { DEFAULT_SETTINGS, type Category, type Commitment, type Goal, type GoalContribution, type InboxItem, type InstallmentPayment, type InstallmentPlan, type Line, type Payment, type Rule, type Settings, type Tx } from "./types";
import { getSupabase } from "./supabase";
import { DEFAULT_CATEGORIES, type CategoryInput, type CommitmentInput, type GoalInput, type LineInput, type PlanInput, type Repo, type TxInput } from "./repo";

const HISTORY_DAYS = 150;

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function uid(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("انتهت الجلسة، سجّل دخولك من جديد");
  return id;
}

const TX_COLS = "id, amount_halalas, kind, category_id, merchant, note, occurred_on, source";
const CAT_COLS = "id, name, emoji, sort, line_id";
const LINE_COLS = "id, name, emoji, kind, counts_daily, plans, opening_halalas, tracking_start, sort, active";
const COM_COLS = "id, name, emoji, amount_halalas, due_day, active";
const PAY_COLS = "id, commitment_id, cycle_start, paid_on, amount_halalas";
const SET_COLS = "cycle_day, weekend_shift, salary_halalas, spending_budget_halalas, daily_allowance_halalas, ingest_token_hash";
const INBOX_COLS = "id, raw_text, bank, direction, amount_halalas, merchant, merchant_key, card_last4, occurred_on, status, transaction_id, created_at";
const RULE_COLS = "id, merchant_key, category_id, ignore, hits";
const PLAN_COLS = "id, name, provider, installment_halalas, total_count, first_due, period, active";
const PLAN_PAY_COLS = "id, plan_id, number, paid_on, amount_halalas";
const GOAL_COLS = "id, name, emoji, target_halalas, monthly_halalas, deadline, created_on";
const CONTRIB_COLS = "id, goal_id, amount_halalas, on:on_date";

/** Supabase returns at most 1000 rows per request, so page through until a short page comes back. */
async function fetchAllTxs(from: string): Promise<Tx[]> {
  const sb = getSupabase();
  const out: Tx[] = [];
  for (let page = 0; page < 50; page++) {
    const rows = check<Tx[]>(
      await sb.from("transactions").select(TX_COLS).gte("occurred_on", from)
        .order("occurred_on", { ascending: false }).order("created_at", { ascending: false })
        .range(page * 1000, page * 1000 + 999),
    );
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export const supabaseRepo: Repo = {
  async load(today) {
    const sb = getSupabase();
    // Lines first: the cumulative surplus needs every transaction since the earliest tracking start.
    const lines = check<Line[]>(await sb.from("budget_lines").select(LINE_COLS).order("sort"));
    const earliest = lines.reduce((m, l) => (l.tracking_start < m ? l.tracking_start : m), addDays(today, -HISTORY_DAYS));
    const from = earliest < addDays(today, -HISTORY_DAYS) ? earliest : addDays(today, -HISTORY_DAYS);
    const [set, cats, txs, coms, pays, inbox, rules, plans, planPays, goals, contribs] = await Promise.all([
      sb.from("settings").select(SET_COLS).maybeSingle(),
      sb.from("categories").select(CAT_COLS).order("sort"),
      fetchAllTxs(from),
      sb.from("commitments").select(COM_COLS).order("due_day"),
      sb.from("commitment_payments").select(PAY_COLS).gte("cycle_start", from),
      sb.from("inbox").select(INBOX_COLS).order("created_at", { ascending: false }).limit(100),
      sb.from("merchant_rules").select(RULE_COLS),
      sb.from("installment_plans").select(PLAN_COLS).order("first_due"),
      sb.from("installment_payments").select(PLAN_PAY_COLS),
      sb.from("goals").select(GOAL_COLS).order("created_at"),
      sb.from("goal_contributions").select(CONTRIB_COLS).order("on_date", { ascending: false }),
    ]);
    let categories = check<Category[]>(cats);
    if (categories.length === 0) {
      const owner = await uid();
      categories = check<Category[]>(
        await sb.from("categories")
          .insert(DEFAULT_CATEGORIES.map(([name, emoji], i) => ({ owner_id: owner, name, emoji, sort: i })))
          .select(CAT_COLS),
      );
      categories.sort((a, b) => a.sort - b.sort);
    }
    return {
      settings: check<Settings | null>(set) ?? DEFAULT_SETTINGS,
      categories,
      lines,
      txs,
      commitments: check<Commitment[]>(coms),
      payments: check<Payment[]>(pays),
      inbox: check<InboxItem[]>(inbox),
      rules: check<Rule[]>(rules),
      plans: check<InstallmentPlan[]>(plans),
      planPayments: check<InstallmentPayment[]>(planPays),
      goals: check<Goal[]>(goals),
      contributions: check<GoalContribution[]>(contribs),
    };
  },

  async saveSettings(s) {
    const owner = await uid();
    return check<Settings>(
      await getSupabase().from("settings")
        .upsert({ owner_id: owner, ...s, updated_at: new Date().toISOString() })
        .select(SET_COLS).single(),
    );
  },

  async saveTx(t: TxInput) {
    const sb = getSupabase();
    const row = {
      amount_halalas: t.amount_halalas, kind: t.kind, category_id: t.category_id,
      merchant: t.merchant, note: t.note, occurred_on: t.occurred_on,
    };
    if (t.id) return check<Tx>(await sb.from("transactions").update(row).eq("id", t.id).select(TX_COLS).single());
    return check<Tx>(await sb.from("transactions").insert(row).select(TX_COLS).single());
  },

  async deleteTx(id) {
    check(await getSupabase().from("transactions").delete().eq("id", id));
  },

  async saveCommitment(c: CommitmentInput) {
    const sb = getSupabase();
    const row = { name: c.name, emoji: c.emoji, amount_halalas: c.amount_halalas, due_day: c.due_day, active: c.active };
    if (c.id) return check<Commitment>(await sb.from("commitments").update(row).eq("id", c.id).select(COM_COLS).single());
    return check<Commitment>(await sb.from("commitments").insert(row).select(COM_COLS).single());
  },

  async deleteCommitment(id) {
    check(await getSupabase().from("commitments").delete().eq("id", id));
  },

  async pay(p) {
    return check<Payment>(await getSupabase().from("commitment_payments").insert(p).select(PAY_COLS).single());
  },

  async unpay(id) {
    check(await getSupabase().from("commitment_payments").delete().eq("id", id));
  },

  async saveLine(l: LineInput) {
    const sb = getSupabase();
    const row = {
      name: l.name, emoji: l.emoji, kind: l.kind, counts_daily: l.counts_daily, plans: l.plans,
      opening_halalas: l.opening_halalas, tracking_start: l.tracking_start, sort: l.sort, active: l.active,
    };
    if (l.id) return check<Line>(await sb.from("budget_lines").update(row).eq("id", l.id).select(LINE_COLS).single());
    return check<Line>(await sb.from("budget_lines").insert(row).select(LINE_COLS).single());
  },

  async deleteLine(id) {
    check(await getSupabase().from("budget_lines").delete().eq("id", id));
  },

  async saveCategory(c: CategoryInput) {
    const sb = getSupabase();
    const row = { name: c.name, emoji: c.emoji, sort: c.sort, line_id: c.line_id };
    if (c.id) return check<Category>(await sb.from("categories").update(row).eq("id", c.id).select(CAT_COLS).single());
    return check<Category>(await sb.from("categories").insert(row).select(CAT_COLS).single());
  },

  async deleteCategory(id) {
    check(await getSupabase().from("categories").delete().eq("id", id));
  },

  async ingest(raw, p) {
    const { data, error } = await getSupabase().rpc("ingest_sms_self", {
      p_raw: raw, p_bank: p.bank, p_direction: p.direction, p_amount: p.amount_halalas, p_merchant: p.merchant,
      p_merchant_key: p.merchant_key, p_card: p.card_last4, p_date: p.occurred_on, p_hint: p.category_hint,
    });
    if (error) throw new Error(error.message);
    return { status: (data as { status: string }).status };
  },

  async saveRule(merchantKey, categoryId) {
    const owner = await uid();
    check(await getSupabase().from("merchant_rules").upsert(
      { owner_id: owner, merchant_key: merchantKey, category_id: categoryId, ignore: false },
      { onConflict: "owner_id,merchant_key" },
    ));
  },

  async resolveInbox(item) {
    check(await getSupabase().from("inbox").update({ status: "done" }).eq("id", item.id));
  },

  async classifyInbox(item, categoryId) {
    const sb = getSupabase();
    if (item.transaction_id) check(await sb.from("transactions").update({ category_id: categoryId }).eq("id", item.transaction_id));
    if (item.merchant_key) await supabaseRepo.saveRule(item.merchant_key, categoryId);
    check(await sb.from("inbox").update({ status: "done" }).eq("id", item.id));
  },

  async ignoreInbox(item) {
    const sb = getSupabase();
    if (item.transaction_id) check(await sb.from("transactions").delete().eq("id", item.transaction_id));
    if (item.merchant_key) {
      const owner = await uid();
      check(await sb.from("merchant_rules").upsert(
        { owner_id: owner, merchant_key: item.merchant_key, category_id: null, ignore: true },
        { onConflict: "owner_id,merchant_key" },
      ));
    }
    check(await sb.from("inbox").update({ status: "ignored", transaction_id: null }).eq("id", item.id));
  },

  async recordInbox(item, categoryId) {
    if (!item.amount_halalas) throw new Error("الرسالة ما فيها مبلغ مقروء، سجّلها يدوياً");
    const sb = getSupabase();
    const tx = check<{ id: string }>(
      await sb.from("transactions").insert({
        amount_halalas: item.amount_halalas, kind: item.direction === "refund" ? "refund" : "expense",
        category_id: categoryId, merchant: item.merchant, occurred_on: item.occurred_on ?? new Date().toISOString().slice(0, 10),
        source: "sms",
      }).select("id").single(),
    );
    check(await sb.from("inbox").update({ status: "done", transaction_id: tx.id }).eq("id", item.id));
  },

  async savePlan(p: PlanInput) {
    const sb = getSupabase();
    const row = {
      name: p.name, provider: p.provider, installment_halalas: p.installment_halalas, total_count: p.total_count,
      first_due: p.first_due, period: p.period, active: p.active,
    };
    if (p.id) return check<InstallmentPlan>(await sb.from("installment_plans").update(row).eq("id", p.id).select(PLAN_COLS).single());
    return check<InstallmentPlan>(await sb.from("installment_plans").insert(row).select(PLAN_COLS).single());
  },
  async deletePlan(id) {
    check(await getSupabase().from("installment_plans").delete().eq("id", id));
  },
  async payInstallment(p) {
    return check<InstallmentPayment>(await getSupabase().from("installment_payments").insert(p).select(PLAN_PAY_COLS).single());
  },
  async unpayInstallment(id) {
    check(await getSupabase().from("installment_payments").delete().eq("id", id));
  },

  async saveGoal(g: GoalInput) {
    const sb = getSupabase();
    const row = { name: g.name, emoji: g.emoji, target_halalas: g.target_halalas, monthly_halalas: g.monthly_halalas, deadline: g.deadline };
    if (g.id) return check<Goal>(await sb.from("goals").update(row).eq("id", g.id).select(GOAL_COLS).single());
    return check<Goal>(await sb.from("goals").insert({ ...row, created_on: g.created_on }).select(GOAL_COLS).single());
  },
  async deleteGoal(id) {
    check(await getSupabase().from("goals").delete().eq("id", id));
  },
  async addContribution(c) {
    return check<GoalContribution>(
      await getSupabase().from("goal_contributions")
        .insert({ goal_id: c.goal_id, amount_halalas: c.amount_halalas, on_date: c.on }).select(CONTRIB_COLS).single(),
    );
  },
  async deleteContribution(id) {
    check(await getSupabase().from("goal_contributions").delete().eq("id", id));
  },

  async importData(d) {
    const sb = getSupabase();
    const owner = await uid();
    // Parents before children so every foreign key finds its row. Upsert by id: running it twice is harmless.
    const put = async (table: string, rows: object[], onConflict = "id") => {
      for (let i = 0; i < rows.length; i += 400) {
        check(await sb.from(table).upsert(rows.slice(i, i + 400).map((r) => ({ ...r, owner_id: owner })), { onConflict }));
      }
    };
    const { settings: st } = d;
    check(await sb.from("settings").upsert({ owner_id: owner, ...st, updated_at: new Date().toISOString() }));
    await put("budget_lines", d.lines);
    await put("categories", d.categories);
    await put("merchant_rules", d.rules, "owner_id,merchant_key");
    await put("transactions", d.txs);
    await put("commitments", d.commitments);
    await put("commitment_payments", d.payments);
    await put("installment_plans", d.plans);
    await put("installment_payments", d.planPayments);
    await put("goals", d.goals);
    await put("goal_contributions", d.contributions.map(({ on, ...c }) => ({ ...c, on_date: on })));
  },
};
