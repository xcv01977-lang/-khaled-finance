import { addDays } from "./cycle";
import { DEFAULT_SETTINGS, type Category, type Commitment, type Payment, type Settings, type Tx } from "./types";
import { getSupabase } from "./supabase";
import { DEFAULT_CATEGORIES, type CommitmentInput, type Repo, type TxInput } from "./repo";

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
const CAT_COLS = "id, name, emoji, sort";
const COM_COLS = "id, name, emoji, amount_halalas, due_day, active";
const PAY_COLS = "id, commitment_id, cycle_start, paid_on, amount_halalas";
const SET_COLS = "cycle_day, weekend_shift, salary_halalas, spending_budget_halalas, daily_allowance_halalas";

export const supabaseRepo: Repo = {
  async load(today) {
    const sb = getSupabase();
    const from = addDays(today, -HISTORY_DAYS);
    const [set, cats, txs, coms, pays] = await Promise.all([
      sb.from("settings").select(SET_COLS).maybeSingle(),
      sb.from("categories").select(CAT_COLS).order("sort"),
      sb.from("transactions").select(TX_COLS).gte("occurred_on", from)
        .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("commitments").select(COM_COLS).order("due_day"),
      sb.from("commitment_payments").select(PAY_COLS).gte("cycle_start", from),
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
      txs: check<Tx[]>(txs),
      commitments: check<Commitment[]>(coms),
      payments: check<Payment[]>(pays),
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
};
