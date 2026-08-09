-- Itemized deductions per salary slip (e.g. salary advances taken during
-- the month). Mirrors salary_slip_trips but subtracts from the slip total
-- instead of adding. Run after 0011_salary.sql.

create table salary_slip_deductions (
  id uuid primary key default gen_random_uuid(),
  salary_slip_id uuid not null references salary_slips(id) on delete cascade,
  deduction_date date not null default current_date,
  description text not null default '',
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index salary_slip_deductions_slip_idx on salary_slip_deductions(salary_slip_id);

alter table salary_slip_deductions enable row level security;

create policy salary_slip_deductions_owner_only on salary_slip_deductions for all
using (is_owner()) with check (is_owner());
