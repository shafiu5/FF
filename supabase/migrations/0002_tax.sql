-- Shared tax rate setting, plus a tax breakdown on expenses.
-- `amount` keeps meaning "total paid" (so every existing sum/report stays
-- correct); tax_amount is the tax portion extracted from that total, not
-- an amount added on top. Run after 0001_init.sql.

-- Singleton settings row (id is always `true`, so only one row can exist).
create table app_settings (
  id boolean primary key default true check (id),
  tax_percent numeric not null default 0 check (tax_percent >= 0),
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (true);

alter table app_settings enable row level security;

create policy app_settings_all on app_settings for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

alter table expenses add column has_tax boolean not null default false;
-- Snapshot of the rate in effect when the expense was entered, so later
-- changes to the settings rate don't rewrite historical expenses.
alter table expenses add column tax_percent numeric;
alter table expenses add column tax_amount numeric;
