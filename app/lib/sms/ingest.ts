import type { Parsed } from "./parse";
import type { Category, InboxStatus, Rule } from "../types";

export type IngestPlan = {
  status: InboxStatus;
  /** Set when the message becomes a transaction. */
  tx: { amount_halalas: number; kind: "expense" | "refund"; category_id: string | null; merchant: string | null } | null;
  ruleHit: string | null;
};

type Ctx = { rules: Rule[]; categories: Category[]; isDuplicate: boolean };

/**
 * Same decisions as public._ingest in supabase/migrations/0003_sms_inbox.sql. The database function is what
 * runs in production; this copy runs the in-browser demo and documents the rules in testable form.
 */
export function planIngest(p: Parsed, { rules, categories, isDuplicate }: Ctx): IngestPlan {
  if (isDuplicate) return { status: "duplicate", tx: null, ruleHit: null };

  const rule = p.merchant_key ? rules.find((r) => r.merchant_key === p.merchant_key) : undefined;
  const records = p.direction === "purchase" || p.direction === "withdrawal" || p.direction === "refund";

  if (p.direction === "deposit" || p.direction === "transfer_in" || rule?.ignore) {
    return { status: "ignored", tx: null, ruleHit: null };
  }
  if (records && p.amount_halalas !== null) {
    const kind = p.direction === "refund" ? "refund" : "expense";
    const merchant = p.merchant?.trim() || null;
    if (rule?.category_id) {
      return { status: "auto", tx: { amount_halalas: p.amount_halalas, kind, category_id: rule.category_id, merchant }, ruleHit: rule.id };
    }
    const guess = p.category_hint ? categories.find((c) => c.name === p.category_hint) : undefined;
    return { status: "review", tx: { amount_halalas: p.amount_halalas, kind, category_id: guess?.id ?? null, merchant }, ruleHit: null };
  }
  if (records) return { status: "unparsed", tx: null, ruleHit: null };
  return { status: "review", tx: null, ruleHit: null };
}
