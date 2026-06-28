-- =====================================================================
-- Ghar Kharcha — Supabase setup
-- Ise Supabase Dashboard > SQL Editor me paste karke "Run" dabayein.
-- Dobara run karna safe hai (re-runnable).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- accounts (paisa kahan rakha hai: Cash / Bank) -------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null default 'Cash',         -- Cash | Bank
  opening_balance numeric not null default 0,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ---------- contracts (theka) ----------------------------------------
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  thekedar_name text,
  kaam          text,
  theka_amount  numeric not null default 0,
  start_date    date,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------- transactions (har rupaya: In / Out / Transfer) -----------
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null default current_date,
  type           text not null,                          -- In | Out | Transfer
  amount         numeric not null default 0,
  account_id     uuid references public.accounts(id) on delete set null,
  to_account_id  uuid references public.accounts(id) on delete set null,
  payment_mode   text,                                   -- Cash | UPI | Net Banking | Online | Udhaar
  category       text,                                   -- Material | Labour | Theka Payment | Misc
  item           text,
  qty            numeric,
  unit           text,
  rate           numeric,
  vendor         text,
  contract_id    uuid references public.contracts(id) on delete set null,
  source         text,                                   -- In ke liye: kaha se aaya
  from_party     text,
  notes          text,
  bill_photo_url text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_tx_user_date on public.transactions(user_id, date desc);

-- ---------- Row Level Security: sirf apna data ------------------------
alter table public.accounts     enable row level security;
alter table public.contracts    enable row level security;
alter table public.transactions enable row level security;

drop policy if exists own_accounts     on public.accounts;
drop policy if exists own_contracts    on public.contracts;
drop policy if exists own_transactions on public.transactions;

create policy own_accounts     on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_contracts    on public.contracts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_transactions on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Done. Ab app me Project URL + anon key daalein.
