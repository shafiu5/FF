-- Vessel Finance: expenses, income, and the tax-free omit list.
-- Run this in the SAME Supabase project as fuel-tracker (it references
-- fuel-tracker's `vessels` table), after fuel-tracker's migrations
-- 0001-0004 have already been applied.

create table expenses (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references vessels(id) on delete set null,
  category text not null,
  amount numeric not null check (amount > 0),
  expense_date date not null default current_date,
  vendor text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table income_entries (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references vessels(id) on delete set null,
  amount numeric not null check (amount > 0),
  income_date date not null default current_date,
  reference text not null default '',
  description text not null default '',
  is_tax_free boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Saved reference/invoice numbers that auto-flag matching Excel import
-- rows as tax-free. Rows are still imported, never dropped.
create table omit_rules (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  label text not null default '',
  created_at timestamptz not null default now()
);

create index expenses_vessel_idx on expenses(vessel_id);
create index expenses_date_idx on expenses(expense_date);
create index income_entries_vessel_idx on income_entries(vessel_id);
create index income_entries_date_idx on income_entries(income_date);

alter table expenses enable row level security;
alter table income_entries enable row level security;
alter table omit_rules enable row level security;

create policy expenses_all on expenses for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy income_entries_all on income_entries for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy omit_rules_all on omit_rules for all
using (auth.uid() is not null)
with check (auth.uid() is not null);
