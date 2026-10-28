-- Phase 2: salary split into budget lines with a cumulative surplus/deficit per line.
-- Add-only: existing rows are untouched.

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '📌',
  kind text not null default 'custom' check (kind in ('expenses', 'investment', 'emergency', 'custom')),
  counts_daily boolean not null default false,
  -- [{ "from": "2026-10-27", "amount_halalas": 500000 }]: a plan applies from that cycle start onward,
  -- so changing it never rewrites the surplus of cycles that already closed.
  plans jsonb not null default '[]' check (jsonb_typeof(plans) = 'array'),
  opening_halalas bigint not null default 0,
  tracking_start date not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index budget_lines_owner_idx on public.budget_lines (owner_id, sort);

alter table public.categories
  add column line_id uuid references public.budget_lines(id) on delete set null;

alter table public.budget_lines enable row level security;
create policy "owner all" on public.budget_lines for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
