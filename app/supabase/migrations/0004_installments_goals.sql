-- Phase 5: Tabby/Tamara-style instalment plans and savings goals. Add-only.

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  provider text not null default 'other' check (provider in ('tabby', 'tamara', 'other')),
  installment_halalas bigint not null check (installment_halalas > 0),
  total_count int not null check (total_count between 1 and 60),
  first_due date not null,
  period text not null default 'monthly' check (period in ('monthly', 'biweekly', 'weekly')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index installment_plans_owner_idx on public.installment_plans (owner_id);

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  number int not null check (number >= 1),
  paid_on date not null,
  amount_halalas bigint not null check (amount_halalas > 0),
  created_at timestamptz not null default now(),
  unique (plan_id, number)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '🎯',
  target_halalas bigint not null check (target_halalas > 0),
  monthly_halalas bigint check (monthly_halalas > 0),
  deadline date,
  created_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount_halalas bigint not null check (amount_halalas <> 0),
  on_date date not null,
  created_at timestamptz not null default now()
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id, on_date);

alter table public.installment_plans enable row level security;
alter table public.installment_payments enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy "owner all" on public.installment_plans for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.installment_payments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.goals for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.goal_contributions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
