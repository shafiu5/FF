-- Employee loans: a principal amount repaid via a fixed monthly
-- installment, auto-deducted from that employee's slip when a new salary
-- run is created (capped at whatever balance remains). Skipping a month
-- is just deleting that auto-added deduction before confirming the run,
-- same as removing any other deduction. Run after 0012_salary_deductions.sql.

create table employee_loans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  principal_amount numeric not null check (principal_amount > 0),
  monthly_installment numeric not null default 0 check (monthly_installment >= 0),
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

-- Tags a deduction as a loan repayment so we can compute the remaining
-- balance and auto-fill future installments. set null (not cascade) on
-- delete: removing a loan definition shouldn't erase the amounts already
-- deducted from past payslips.
alter table salary_slip_deductions
  add column loan_id uuid references employee_loans(id) on delete set null;

create index employee_loans_employee_idx on employee_loans(employee_id);
create index salary_slip_deductions_loan_idx on salary_slip_deductions(loan_id);

alter table employee_loans enable row level security;

create policy employee_loans_owner_only on employee_loans for all
using (is_owner()) with check (is_owner());

-- Remaining balance per loan, aggregated server-side.
create view loan_balances
with (security_invoker = true) as
select
  l.id as loan_id,
  l.employee_id,
  l.principal_amount,
  l.monthly_installment,
  l.status,
  coalesce(sum(d.amount), 0) as paid_amount,
  l.principal_amount - coalesce(sum(d.amount), 0) as remaining_amount
from employee_loans l
left join salary_slip_deductions d on d.loan_id = l.id
group by l.id;
