import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { bundle } from "../scripts/bundle-sql.mjs";

const root = join(__dirname, "..", "supabase");

describe("supabase/setup.sql", () => {
  it("is exactly the migrations in order (run `npm run bundle-sql` if this fails)", () => {
    expect(readFileSync(join(root, "setup.sql"), "utf8")).toBe(bundle(join(root, "migrations")));
  });

  it("runs on a fresh database in one go and creates every table with row level security", async () => {
    const db = new PGlite();
    await db.exec(`
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role anon; create role authenticated;`);
    await db.exec(readFileSync(join(root, "setup.sql"), "utf8"));
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    const names = r.rows.map((x) => x.relname);
    expect(names).toEqual([
      "budget_lines", "categories", "commitment_payments", "commitments", "goal_contributions", "goals", "inbox",
      "installment_payments", "installment_plans", "merchant_rules", "settings", "transactions",
    ]);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });
});
