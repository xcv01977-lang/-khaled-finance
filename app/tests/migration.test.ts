import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

// Supabase provides auth.users and auth.uid(); stand in for them so the real migration runs unchanged.
// A non-superuser role is needed because row level security does not apply to superusers.
const authStub = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  insert into auth.users values ('${A}'), ('${B}');
  create role app_user;
  grant usage on schema auth, public to app_user;
  grant execute on function auth.uid() to app_user;
`;

async function as(uid: string | null, fn: () => Promise<unknown>) {
  await db.exec(`set role app_user; select set_config('app.uid', '${uid ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(authStub);
  const dir = join(__dirname, "../supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(`grant all on all tables in schema public to app_user;`);
});

describe("migration 0001", () => {
  it("applies and gives settings sensible defaults for the signed-in user", async () => {
    await as(A, () => db.query(`insert into settings default values`));
    const r = await as(A, () => db.query<{ cycle_day: number; weekend_shift: boolean }>(`select * from settings`));
    expect((r as { rows: { cycle_day: number; weekend_shift: boolean }[] }).rows[0]).toMatchObject({
      cycle_day: 27,
      weekend_shift: true,
    });
  });

  it("hides one user's rows from another and blocks cross-user writes", async () => {
    await as(A, () =>
      db.query(`insert into transactions (amount_halalas, occurred_on) values (1800, '2026-10-28')`),
    );
    const seenByB = (await as(B, () => db.query(`select * from transactions`))) as { rows: unknown[] };
    expect(seenByB.rows).toHaveLength(0);
    await expect(
      as(B, () =>
        db.query(`insert into transactions (owner_id, amount_halalas, occurred_on) values ('${A}', 100, '2026-10-28')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("returns nothing when nobody is signed in", async () => {
    const r = (await as(null, () => db.query(`select * from transactions`))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });

  it("rejects non-positive amounts and unknown kinds", async () => {
    await expect(
      as(A, () => db.query(`insert into transactions (amount_halalas, occurred_on) values (0, '2026-10-28')`)),
    ).rejects.toThrow();
    await expect(
      as(A, () =>
        db.query(`insert into transactions (amount_halalas, kind, occurred_on) values (5, 'gift', '2026-10-28')`),
      ),
    ).rejects.toThrow();
  });

  it("allows only one payment per commitment per cycle", async () => {
    const c = (await as(A, () =>
      db.query<{ id: string }>(
        `insert into commitments (name, amount_halalas, due_day) values ('الإيجار', 320000, 1) returning id`,
      ),
    )) as { rows: { id: string }[] };
    const id = c.rows[0].id;
    const pay = `insert into commitment_payments (commitment_id, cycle_start, paid_on, amount_halalas)
                 values ('${id}', '2026-10-27', '2026-11-01', 320000)`;
    await as(A, () => db.query(pay));
    await expect(as(A, () => db.query(pay))).rejects.toThrow(/unique/);
  });

  it("keeps transactions when a category is deleted", async () => {
    const c = (await as(A, () =>
      db.query<{ id: string }>(`insert into categories (name, emoji) values ('قهوة', '☕') returning id`),
    )) as { rows: { id: string }[] };
    await as(A, () =>
      db.query(
        `insert into transactions (amount_halalas, category_id, occurred_on) values (1800, '${c.rows[0].id}', '2026-10-28')`,
      ),
    );
    await as(A, () => db.query(`delete from categories where id = '${c.rows[0].id}'`));
    const r = (await as(A, () =>
      db.query(`select * from transactions where amount_halalas = 1800 and category_id is null`),
    )) as { rows: unknown[] };
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it("0002: budget lines are private, validate their shape, and unlink categories on delete", async () => {
    const ins = `insert into budget_lines (name, kind, tracking_start, plans) values ('مصاريف', 'expenses', '2026-10-27',
      '[{"from":"2026-10-27","amount_halalas":500000}]') returning id`;
    const l = (await as(A, () => db.query<{ id: string }>(ins))) as { rows: { id: string }[] };
    const seenByB = (await as(B, () => db.query(`select * from budget_lines`))) as { rows: unknown[] };
    expect(seenByB.rows).toHaveLength(0);

    await expect(
      as(A, () => db.query(`insert into budget_lines (name, kind, tracking_start) values ('x', 'bogus', '2026-10-27')`)),
    ).rejects.toThrow();
    await expect(
      as(A, () => db.query(`insert into budget_lines (name, tracking_start, plans) values ('x', '2026-10-27', '{}')`)),
    ).rejects.toThrow();

    const c = (await as(A, () =>
      db.query<{ id: string }>(`insert into categories (name, line_id) values ('أكل', '${l.rows[0].id}') returning id`),
    )) as { rows: { id: string }[] };
    await as(A, () => db.query(`delete from budget_lines where id = '${l.rows[0].id}'`));
    const after = (await as(A, () =>
      db.query<{ line_id: string | null }>(`select line_id from categories where id = '${c.rows[0].id}'`),
    )) as { rows: { line_id: string | null }[] };
    expect(after.rows[0].line_id).toBeNull();
  });
});
