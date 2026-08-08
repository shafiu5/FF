-- Line items under a single income entry — for importing a whole file
-- (e.g. one ferry trip manifest) as one income entry named after the file,
-- with each passenger/row kept as a breakdown line you can expand to see.
-- Run after 0003_import_batch.sql.

create table income_entry_lines (
  id uuid primary key default gen_random_uuid(),
  income_entry_id uuid not null references income_entries(id) on delete cascade,
  name text not null default '',
  amount numeric not null check (amount >= 0),
  reference text not null default '',
  created_at timestamptz not null default now()
);

create index income_entry_lines_entry_idx on income_entry_lines(income_entry_id);

alter table income_entry_lines enable row level security;

create policy income_entry_lines_all on income_entry_lines for all
using (auth.uid() is not null)
with check (auth.uid() is not null);
