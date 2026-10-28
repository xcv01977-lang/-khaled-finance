import { demoRepo } from "./repo-demo";
import { supabaseRepo } from "./repo-supabase";
import type { Commitment, Payment, Settings, Snapshot, Tx } from "./types";

export type TxInput = Omit<Tx, "id" | "source"> & { id?: string };
export type CommitmentInput = Omit<Commitment, "id"> & { id?: string };

export interface Repo {
  load(today: string): Promise<Snapshot>;
  saveSettings(s: Settings): Promise<Settings>;
  saveTx(t: TxInput): Promise<Tx>;
  deleteTx(id: string): Promise<void>;
  saveCommitment(c: CommitmentInput): Promise<Commitment>;
  deleteCommitment(id: string): Promise<void>;
  pay(p: Omit<Payment, "id">): Promise<Payment>;
  unpay(id: string): Promise<void>;
}

/** NEXT_PUBLIC_DEMO=1 keeps everything in this browser, for previews and tests. Never set it in production. */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export const getRepo = (): Repo => (IS_DEMO ? demoRepo : supabaseRepo);

export const DEFAULT_CATEGORIES = [
  ["بقالة", "🛒"], ["مطاعم", "🍽️"], ["قهوة", "☕"], ["بنزين", "⛽"], ["مواصلات", "🚗"],
  ["تسوق", "🛍️"], ["صحة", "💊"], ["ترفيه", "🎬"], ["فواتير", "💡"], ["اشتراكات", "📱"], ["أخرى", "📌"],
] as const;
