-- Phase 1: settings, categories, transactions, fixed commitments.
-- Rules for every later migration: add only (create/alter ... add). Never drop or rewrite user data.
-- Amounts are integer halalas (1 SAR = 100 halalas).

create table public.settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cycle_day int not null default 27 check (cycle_day between 1 and 31),
  weekend_shift boolean not null default true,
  salary_halalas bigint not null default 0 check (salary_halalas >= 0),
  spending_budget_halalas bigint check (spending_budget_halalas >= 0),
  daily_allowance_halalas bigint check (daily_allowance_halalas >= 0),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '📌',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_owner_idx on public.categories (owner_id, sort);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount_halalas bigint not null check (amount_halalas > 0),
  kind text not null default 'expense' check (kind in ('expense', 'refund')),
  category_id uuid references public.categories(id) on delete set null,
  merchant text,
  note text,
  occurred_on date not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create index transactions_owner_date_idx on public.transactions (owner_id, occurred_on desc);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '📌',
  amount_halalas bigint not null check (amount_halalas > 0),
  due_day int not null check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index commitments_owner_idx on public.commitments (owner_id);

create table public.commitment_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  cycle_start date not null,
  paid_on date not null,
  amount_halalas bigint not null check (amount_halalas > 0),
  created_at timestamptz not null default now(),
  unique (commitment_id, cycle_start)
);

-- Row level security: every row is visible and writable only by its owner.
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_payments enable row level security;

create policy "owner all" on public.settings for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.categories for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.transactions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.commitments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.commitment_payments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
