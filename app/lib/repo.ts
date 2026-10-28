import { demoRepo } from "./repo-demo";
import { supabaseRepo } from "./repo-supabase";
import type { ExportData } from "./export";
import type { Parsed } from "./sms/parse";
import type { Category, Commitment, Goal, GoalContribution, InboxItem, InstallmentPayment, InstallmentPlan, Line, Payment, Settings, Snapshot, Tx } from "./types";

export type TxInput = Omit<Tx, "id" | "source"> & { id?: string };
export type CommitmentInput = Omit<Commitment, "id"> & { id?: string };
export type LineInput = Omit<Line, "id"> & { id?: string };
export type CategoryInput = Omit<Category, "id"> & { id?: string };
export type PlanInput = Omit<InstallmentPlan, "id"> & { id?: string };
export type GoalInput = Omit<Goal, "id"> & { id?: string };

export interface Repo {
  load(today: string): Promise<Snapshot>;
  saveSettings(s: Settings): Promise<Settings>;
  saveTx(t: TxInput): Promise<Tx>;
  deleteTx(id: string): Promise<void>;
  saveCommitment(c: CommitmentInput): Promise<Commitment>;
  deleteCommitment(id: string): Promise<void>;
  pay(p: Omit<Payment, "id">): Promise<Payment>;
  unpay(id: string): Promise<void>;
  saveLine(l: LineInput): Promise<Line>;
  deleteLine(id: string): Promise<void>;
  saveCategory(c: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  savePlan(p: PlanInput): Promise<InstallmentPlan>;
  deletePlan(id: string): Promise<void>;
  payInstallment(p: Omit<InstallmentPayment, "id">): Promise<InstallmentPayment>;
  unpayInstallment(id: string): Promise<void>;
  saveGoal(g: GoalInput): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  addContribution(c: Omit<GoalContribution, "id">): Promise<GoalContribution>;
  deleteContribution(id: string): Promise<void>;
  /** Run a pasted bank message through the same pipeline the iPhone Shortcut uses. */
  ingest(raw: string, parsed: Parsed): Promise<{ status: string }>;
  /** Teach the app: this merchant is always this category. Also confirms a recorded message. */
  classifyInbox(item: InboxItem, categoryId: string): Promise<void>;
  /** Drop a message: delete the transaction it made and ignore this merchant from now on. */
  ignoreInbox(item: InboxItem): Promise<void>;
  /** Record a message that was held back (transfer, instalment) as an expense. */
  recordInbox(item: InboxItem, categoryId: string | null): Promise<void>;
  /** Restore from an export. Adds and updates by id; nothing already stored is deleted. */
  importData(data: ExportData): Promise<void>;
  /** Mark a held-back message as handled without recording anything. */
  resolveInbox(item: InboxItem): Promise<void>;
  /** Remember a correction made on a transaction. */
  saveRule(merchantKey: string, categoryId: string): Promise<void>;
}

/** NEXT_PUBLIC_DEMO=1 keeps everything in this browser, for previews and tests. Never set it in production. */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export const getRepo = (): Repo => (IS_DEMO ? demoRepo : supabaseRepo);

export const DEFAULT_CATEGORIES = [
  ["بقالة", "🛒"], ["مطاعم", "🍽️"], ["قهوة", "☕"], ["بنزين", "⛽"], ["مواصلات", "🚗"],
  ["تسوق", "🛍️"], ["صحة", "💊"], ["ترفيه", "🎬"], ["فواتير", "💡"], ["اشتراكات", "📱"], ["أخرى", "📌"],
] as const;
