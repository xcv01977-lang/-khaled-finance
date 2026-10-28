-- Phase 3: bank SMS ingestion.
-- The iPhone Shortcut calls /api/ingest with a secret token. Only a SHA-256 hash of that token is stored,
-- and the ingest function is the only thing the anonymous role may call, so no table is ever exposed to it.

alter table public.settings add column ingest_token_hash text;
create unique index settings_ingest_token_hash_key on public.settings (ingest_token_hash)
  where ingest_token_hash is not null;

-- What the user taught the app: "this merchant is always this category" or "always ignore it".
create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant_key text not null check (length(merchant_key) > 0),
  category_id uuid references public.categories(id) on delete cascade,
  ignore boolean not null default false,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, merchant_key),
  check (ignore or category_id is not null)
);

-- Every message that reached the server, with what was understood from it and what happened to it.
create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_text text not null,
  text_hash text not null,
  bank text,
  direction text not null default 'unknown' check (direction in
    ('purchase', 'withdrawal', 'refund', 'deposit', 'transfer_in', 'transfer_out', 'installment', 'unknown')),
  amount_halalas bigint check (amount_halalas > 0),
  merchant text,
  merchant_key text not null default '',
  card_last4 text,
  occurred_on date,
  -- auto: recorded by a rule the user taught; review: needs a look; done: user resolved it;
  -- ignored / duplicate: nothing recorded; unparsed: money event but no readable amount.
  status text not null check (status in ('auto', 'review', 'done', 'ignored', 'duplicate', 'unparsed')),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inbox_owner_created_idx on public.inbox (owner_id, created_at desc);
create index inbox_hash_idx on public.inbox (owner_id, text_hash, created_at desc);

alter table public.merchant_rules enable row level security;
alter table public.inbox enable row level security;
create policy "owner all" on public.merchant_rules for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner all" on public.inbox for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Core: decide what a parsed message becomes. Not callable by clients; the two wrappers below are.
create function public._ingest(
  p_owner uuid, p_raw text, p_bank text, p_direction text, p_amount bigint, p_merchant text,
  p_merchant_key text, p_card text, p_date date, p_hint text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_raw, ''), 'UTF8')), 'hex');
  v_dir text := case when p_direction in ('purchase', 'withdrawal', 'refund', 'deposit', 'transfer_in',
                  'transfer_out', 'installment') then p_direction else 'unknown' end;
  v_key text := coalesce(p_merchant_key, '');
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Riyadh')::date);
  v_rule merchant_rules%rowtype;
  v_cat uuid;
  v_tx uuid;
  v_status text;
  v_id uuid;
begin
  if p_raw is null or length(trim(p_raw)) = 0 then
    raise exception 'empty message';
  end if;
  if p_amount is not null and p_amount <= 0 then
    p_amount := null;
  end if;

  -- The same text twice within ten minutes is the Shortcut firing twice, not a second purchase.
  if exists (select 1 from inbox where owner_id = p_owner and text_hash = v_hash
             and status <> 'duplicate' and created_at > now() - interval '10 minutes') then
    insert into inbox (owner_id, raw_text, text_hash, bank, direction, amount_halalas, merchant, merchant_key,
                       card_last4, occurred_on, status)
    values (p_owner, p_raw, v_hash, p_bank, v_dir, p_amount, p_merchant, v_key, p_card, v_date, 'duplicate')
    returning id into v_id;
    return jsonb_build_object('status', 'duplicate', 'id', v_id);
  end if;

  if v_key <> '' then
    select * into v_rule from merchant_rules where owner_id = p_owner and merchant_key = v_key;
  end if;

  if v_dir in ('deposit', 'transfer_in') or (v_rule.id is not null and v_rule.ignore) then
    v_status := 'ignored';
  elsif v_dir in ('purchase', 'withdrawal', 'refund') and p_amount is not null then
    if v_rule.id is not null and v_rule.category_id is not null then
      v_cat := v_rule.category_id;
      v_status := 'auto';
      update merchant_rules set hits = hits + 1 where id = v_rule.id;
    else
      if p_hint is not null then
        select id into v_cat from categories where owner_id = p_owner and name = p_hint order by sort limit 1;
      end if;
      v_status := 'review';
    end if;
    insert into transactions (owner_id, amount_halalas, kind, category_id, merchant, occurred_on, source)
    values (p_owner, p_amount, case when v_dir = 'refund' then 'refund' else 'expense' end, v_cat,
            nullif(trim(coalesce(p_merchant, '')), ''), v_date, 'sms')
    returning id into v_tx;
  elsif v_dir in ('purchase', 'withdrawal', 'refund') then
    v_status := 'unparsed';
  else
    v_status := 'review'; -- transfer out, instalment, unknown: never recorded without a person looking
  end if;

  insert into inbox (owner_id, raw_text, text_hash, bank, direction, amount_halalas, merchant, merchant_key,
                     card_last4, occurred_on, status, transaction_id)
  values (p_owner, p_raw, v_hash, p_bank, v_dir, p_amount, p_merchant, v_key, p_card, v_date, v_status, v_tx)
  returning id into v_id;

  return jsonb_build_object('status', v_status, 'id', v_id, 'transaction_id', v_tx);
end $$;

revoke all on function public._ingest(uuid, text, text, text, bigint, text, text, text, date, text)
  from public, anon, authenticated;

-- Called by the iPhone Shortcut through /api/ingest, authenticated by the secret token only.
create function public.ingest_sms(
  p_token text, p_raw text, p_bank text, p_direction text, p_amount bigint, p_merchant text,
  p_merchant_key text, p_card text, p_date date, p_hint text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if p_token is null or length(p_token) < 20 then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  select owner_id into v_owner from settings
    where ingest_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if v_owner is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  return _ingest(v_owner, p_raw, p_bank, p_direction, p_amount, p_merchant, p_merchant_key, p_card, p_date, p_hint);
end $$;

-- Same pipeline for a message pasted inside the signed-in app.
create function public.ingest_sms_self(
  p_raw text, p_bank text, p_direction text, p_amount bigint, p_merchant text,
  p_merchant_key text, p_card text, p_date date, p_hint text
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  return _ingest(auth.uid(), p_raw, p_bank, p_direction, p_amount, p_merchant, p_merchant_key, p_card, p_date, p_hint);
end $$;

revoke all on function public.ingest_sms(text, text, text, text, bigint, text, text, text, date, text) from public;
revoke all on function public.ingest_sms_self(text, text, text, bigint, text, text, text, date, text) from public;
grant execute on function public.ingest_sms(text, text, text, text, bigint, text, text, text, date, text) to anon, authenticated;
grant execute on function public.ingest_sms_self(text, text, text, bigint, text, text, text, date, text) to authenticated;
