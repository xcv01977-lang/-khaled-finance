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
  create role anon;
  create role authenticated;
  create role app_user;
  grant anon, authenticated to app_user;
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

  describe("0003 sms ingestion", () => {
    const TOKEN = "t".repeat(40);
    const call = (token: string | null, over: Record<string, unknown> = {}) => {
      const a = { raw: "شراء بمبلغ 45.50 SAR لدى STARBUCKS", bank: "الراجحي", dir: "purchase", amount: 4550,
        merchant: "STARBUCKS", key: "starbucks", card: "1234", date: "2026-10-28", hint: "قهوة", ...over };
      return db.query<{ r: { status: string; id: string; transaction_id: string | null } }>(
        `select ingest_sms($1, $2, $3, $4, $5::bigint, $6, $7, $8, $9::date, $10) as r`,
        [token, a.raw, a.bank, a.dir, a.amount, a.merchant, a.key, a.card, a.date, a.hint],
      );
    };
    const status = async (token: string | null, over: Record<string, unknown> = {}) =>
      ((await as(null, () => call(token, over))) as { rows: { r: { status: string } }[] }).rows[0].r.status;

    beforeAll(async () => {
      await db.query(`update settings set ingest_token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex') where owner_id = $2`, [TOKEN, A]);
      await db.query(`insert into categories (owner_id, name, emoji, sort) values ($1, 'قهوة', '☕', 0), ($1, 'مطاعم', '🍽️', 1)`, [A]);
    });

    it("rejects a wrong, short or missing token", async () => {
      await expect(as(null, () => call("x".repeat(40)))).rejects.toThrow(/invalid token/);
      await expect(as(null, () => call("short"))).rejects.toThrow(/invalid token/);
      await expect(as(null, () => call(null))).rejects.toThrow(/invalid token/);
    });

    it("keeps the core function and the tables out of reach of the anonymous role", async () => {
      await expect(
        as(null, () => db.query(`select _ingest('${A}', 'x', null, 'purchase', 100, null, '', null, null, null)`)),
      ).rejects.toThrow(/permission denied/);
      const rows = (await as(null, () => db.query(`select * from inbox`))) as { rows: unknown[] };
      expect(rows.rows).toHaveLength(0);
    });

    it("records an expense for the token's owner, guessing the category from the hint, flagged for review", async () => {
      expect(await status(TOKEN)).toBe("review");
      const t = (await as(A, () =>
        db.query<{ amount_halalas: string; source: string; name: string; merchant: string; occurred_on: string }>(
          `select t.amount_halalas, t.source, c.name, t.merchant, t.occurred_on::text from transactions t
             join categories c on c.id = t.category_id where t.source = 'sms'`,
        ),
      )) as { rows: { amount_halalas: string; source: string; name: string; merchant: string; occurred_on: string }[] };
      expect(t.rows).toHaveLength(1);
      expect(t.rows[0]).toMatchObject({ source: "sms", name: "قهوة", merchant: "STARBUCKS", occurred_on: "2026-10-28" });
      expect(Number(t.rows[0].amount_halalas)).toBe(4550);
    });

    it("treats the same text within ten minutes as a duplicate and records nothing", async () => {
      expect(await status(TOKEN)).toBe("duplicate");
      const n = (await as(A, () => db.query(`select 1 from transactions where source = 'sms'`))) as { rows: unknown[] };
      expect(n.rows).toHaveLength(1);
    });

    it("applies a taught rule automatically and counts the hit", async () => {
      const cat = (await db.query<{ id: string }>(`select id from categories where owner_id = $1 and name = 'مطاعم'`, [A])) as { rows: { id: string }[] };
      await db.query(`insert into merchant_rules (owner_id, merchant_key, category_id) values ($1, 'albaik', $2)`, [A, cat.rows[0].id]);
      expect(await status(TOKEN, { raw: "شراء 30 SAR لدى ALBAIK", merchant: "ALBAIK", key: "albaik", amount: 3000, hint: null })).toBe("auto");
      const r = (await db.query<{ hits: number }>(`select hits from merchant_rules where merchant_key = 'albaik'`)) as { rows: { hits: number }[] };
      expect(r.rows[0].hits).toBe(1);
      const t = (await db.query<{ category_id: string }>(`select category_id from transactions where merchant = 'ALBAIK'`)) as { rows: { category_id: string }[] };
      expect(t.rows[0].category_id).toBe(cat.rows[0].id);
    });

    it("an ignore rule records nothing", async () => {
      await db.query(`insert into merchant_rules (owner_id, merchant_key, ignore) values ($1, 'moi', true)`, [A]);
      expect(await status(TOKEN, { raw: "شراء 5 SAR لدى MOI", merchant: "MOI", key: "moi", amount: 500 })).toBe("ignored");
      const n = (await db.query(`select 1 from transactions where merchant = 'MOI'`)) as { rows: unknown[] };
      expect(n.rows).toHaveLength(0);
    });

    it("deposits and incoming transfers are ignored, never counted as spending", async () => {
      expect(await status(TOKEN, { raw: "إيداع راتب 10000", dir: "deposit", amount: 1000000, merchant: null, key: "" })).toBe("ignored");
      expect(await status(TOKEN, { raw: "حوالة واردة 200", dir: "transfer_in", amount: 20000, merchant: null, key: "" })).toBe("ignored");
    });

    it("transfers out, instalments and unknown messages wait for a person and record nothing", async () => {
      const before = (await db.query(`select count(*)::int as n from transactions`)) as { rows: { n: number }[] };
      for (const [raw, dir] of [["حوالة صادرة 500", "transfer_out"], ["تابي دفعة 2 من 4", "installment"], ["???", "unknown"]]) {
        expect(await status(TOKEN, { raw, dir, amount: 500, merchant: null, key: "" })).toBe("review");
      }
      const after = (await db.query(`select count(*)::int as n from transactions`)) as { rows: { n: number }[] };
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it("a purchase with no readable amount is held as unparsed", async () => {
      expect(await status(TOKEN, { raw: "شراء من ZZZ", amount: null, merchant: "ZZZ", key: "zzz" })).toBe("unparsed");
    });

    it("a refund is recorded as a refund", async () => {
      await status(TOKEN, { raw: "استرجاع 45.50 STARBUCKS", dir: "refund", amount: 4550 });
      const r = (await db.query<{ kind: string }>(`select kind from transactions where merchant = 'STARBUCKS' and kind = 'refund'`)) as { rows: unknown[] };
      expect(r.rows).toHaveLength(1);
    });

    it("the signed-in paste path works for the owner and is refused when signed out", async () => {
      const self = () =>
        db.query(`select ingest_sms_self('شراء 12 SAR لدى X', null, 'purchase', 1200, 'X', 'x', null, null, null) as r`);
      await as(A, () => self());
      await expect(as(null, () => self())).rejects.toThrow(/not signed in|permission denied/);
    });

    it("one user's token cannot write into another user's data", async () => {
      await db.query(`insert into settings (owner_id) values ($1) on conflict do nothing`, [B]);
      const T2 = "u".repeat(40);
      await db.query(`update settings set ingest_token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex') where owner_id = $2`, [T2, B]);
      await as(null, () => call(T2, { raw: "شراء 77 SAR لدى ONLYB", merchant: "ONLYB", key: "onlyb" }));
      const forA = (await db.query(`select 1 from transactions where owner_id = $1 and merchant = 'ONLYB'`, [A])) as { rows: unknown[] };
      const forB = (await db.query(`select 1 from transactions where owner_id = $1 and merchant = 'ONLYB'`, [B])) as { rows: unknown[] };
      expect(forA.rows).toHaveLength(0);
      expect(forB.rows).toHaveLength(1);
    });
  });
});
