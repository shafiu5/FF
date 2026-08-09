-- Payroll: employees with recurring pay defaults, monthly salary runs,
-- one slip per employee per run, and itemized extra trips per slip.
-- Confirming a run turns each slip into a real row in `expenses`
-- (category 'Salary'), the same way Excel-imported income becomes real
-- income_entries rows. Run after 0010_income_entry_line_totals.sql.

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  default_vessel_id uuid references vessels(id) on delete set null,
  basic_salary numeric not null default 0 check (basic_salary >= 0),
  food_allowance numeric not null default 0 check (food_allowance >= 0),
  phone_allowance numeric not null default 0 check (phone_allowance >= 0),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table salary_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Amounts are copied from the employee at run-creation time so later
-- edits to an employee's defaults don't retroactively change past runs.
create table salary_slips (
  id uuid primary key default gen_random_uuid(),
  salary_run_id uuid not null references salary_runs(id) on delete cascade,
  -- restrict, not cascade: deleting an employee must not silently wipe
  -- their payroll history. Deactivate the employee instead.
  employee_id uuid not null references employees(id) on delete restrict,
  vessel_id uuid references vessels(id) on delete set null,
  basic_salary numeric not null default 0 check (basic_salary >= 0),
  food_allowance numeric not null default 0 check (food_allowance >= 0),
  phone_allowance numeric not null default 0 check (phone_allowance >= 0),
  bonus numeric not null default 0 check (bonus >= 0),
  bonus_notes text not null default '',
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table salary_slip_trips (
  id uuid primary key default gen_random_uuid(),
  salary_slip_id uuid not null references salary_slips(id) on delete cascade,
  trip_date date not null default current_date,
  description text not null default '',
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index employees_active_idx on employees(active);
create index salary_slips_run_idx on salary_slips(salary_run_id);
create index salary_slips_employee_idx on salary_slips(employee_id);
create index salary_slip_trips_slip_idx on salary_slip_trips(salary_slip_id);

alter table employees enable row level security;
alter table salary_runs enable row level security;
alter table salary_slips enable row level security;
alter table salary_slip_trips enable row level security;

create policy employees_owner_only on employees for all
using (is_owner()) with check (is_owner());

create policy salary_runs_owner_only on salary_runs for all
using (is_owner()) with check (is_owner());

create policy salary_slips_owner_only on salary_slips for all
using (is_owner()) with check (is_owner());

create policy salary_slip_trips_owner_only on salary_slip_trips for all
using (is_owner()) with check (is_owner());
