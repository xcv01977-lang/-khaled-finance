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

  it("the phase-1 upgrade file is current, and phase 1 + upgrade ends in the same schema as a fresh setup", async () => {
    expect(readFileSync(join(root, "upgrade-from-phase1.sql"), "utf8")).toBe(bundle(join(root, "migrations"), "0001_init.sql"));
    const stub = `
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role anon; create role authenticated;`;
    const schema = async (db: PGlite) =>
      (await db.query<{ t: string; c: string }>(
        `select table_name as t, string_agg(column_name, ',' order by column_name) as c from information_schema.columns
         where table_schema = 'public' group by table_name order by 1`,
      )).rows;

    const fresh = new PGlite();
    await fresh.exec(stub);
    await fresh.exec(readFileSync(join(root, "setup.sql"), "utf8"));

    const upgraded = new PGlite();
    await upgraded.exec(stub);
    await upgraded.exec(readFileSync(join(root, "migrations", "0001_init.sql"), "utf8"));
    await upgraded.exec(readFileSync(join(root, "upgrade-from-phase1.sql"), "utf8"));

    expect(await schema(upgraded)).toEqual(await schema(fresh));
  });
});
