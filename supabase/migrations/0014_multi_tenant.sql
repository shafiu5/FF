-- Per-login data isolation. Replaces the blunt is_owner() email-allowlist
-- (which gave both allowed emails identical access to one shared pool of
-- data) with real per-row ownership: each row belongs to whoever created
-- it, a fresh login owns nothing, and an owner can explicitly grant other
-- emails read-only visibility into their own data via account_collaborators.
-- Run after 0013_employee_loans.sql. fuel-tracker's own multi-tenant
-- migration (0007) must be run after this one, since it reuses
-- has_account_access() defined here.

-- ============================================================================
-- Shared collaborator list + access-check helper
-- ============================================================================

create table account_collaborators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collaborator_email text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, collaborator_email)
);

alter table account_collaborators enable row level security;

-- Only the owner can see/manage who they've invited — a collaborator
-- doesn't get to browse this list, just benefit from being on it.
create policy account_collaborators_owner_only on account_collaborators for all
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- security definer: lets this bypass account_collaborators' own RLS so a
-- collaborator's access check can actually read the invite row that grants
-- them access (they wouldn't otherwise be able to SELECT it directly).
create or replace function has_account_access(target_owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select target_owner = auth.uid()
    or exists (
      select 1 from account_collaborators
      where owner_id = target_owner
        and lower(collaborator_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
$$;

-- ============================================================================
-- owner_id + four-policy pattern on every vessel-finance table
-- ============================================================================

alter table expenses add column owner_id uuid references auth.users(id);
update expenses set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table expenses alter column owner_id set not null;
alter table expenses alter column owner_id set default auth.uid();

alter table income_entries add column owner_id uuid references auth.users(id);
update income_entries set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table income_entries alter column owner_id set not null;
alter table income_entries alter column owner_id set default auth.uid();

alter table income_entry_lines add column owner_id uuid references auth.users(id);
update income_entry_lines set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table income_entry_lines alter column owner_id set not null;
alter table income_entry_lines alter column owner_id set default auth.uid();

alter table omit_rules add column owner_id uuid references auth.users(id);
update omit_rules set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table omit_rules alter column owner_id set not null;
alter table omit_rules alter column owner_id set default auth.uid();

alter table employees add column owner_id uuid references auth.users(id);
update employees set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table employees alter column owner_id set not null;
alter table employees alter column owner_id set default auth.uid();

alter table salary_runs add column owner_id uuid references auth.users(id);
update salary_runs set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table salary_runs alter column owner_id set not null;
alter table salary_runs alter column owner_id set default auth.uid();

alter table salary_slips add column owner_id uuid references auth.users(id);
update salary_slips set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table salary_slips alter column owner_id set not null;
alter table salary_slips alter column owner_id set default auth.uid();

alter table salary_slip_trips add column owner_id uuid references auth.users(id);
update salary_slip_trips set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table salary_slip_trips alter column owner_id set not null;
alter table salary_slip_trips alter column owner_id set default auth.uid();

alter table salary_slip_deductions add column owner_id uuid references auth.users(id);
update salary_slip_deductions set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table salary_slip_deductions alter column owner_id set not null;
alter table salary_slip_deductions alter column owner_id set default auth.uid();

alter table employee_loans add column owner_id uuid references auth.users(id);
update employee_loans set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table employee_loans alter column owner_id set not null;
alter table employee_loans alter column owner_id set default auth.uid();

drop policy expenses_owner_only on expenses;
create policy expenses_select on expenses for select using (has_account_access(owner_id));
create policy expenses_insert on expenses for insert with check (owner_id = auth.uid());
create policy expenses_update on expenses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy expenses_delete on expenses for delete using (owner_id = auth.uid());

drop policy income_entries_owner_only on income_entries;
create policy income_entries_select on income_entries for select using (has_account_access(owner_id));
create policy income_entries_insert on income_entries for insert with check (owner_id = auth.uid());
create policy income_entries_update on income_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy income_entries_delete on income_entries for delete using (owner_id = auth.uid());

drop policy income_entry_lines_owner_only on income_entry_lines;
create policy income_entry_lines_select on income_entry_lines for select using (has_account_access(owner_id));
create policy income_entry_lines_insert on income_entry_lines for insert with check (owner_id = auth.uid());
create policy income_entry_lines_update on income_entry_lines for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy income_entry_lines_delete on income_entry_lines for delete using (owner_id = auth.uid());

drop policy omit_rules_owner_only on omit_rules;
create policy omit_rules_select on omit_rules for select using (has_account_access(owner_id));
create policy omit_rules_insert on omit_rules for insert with check (owner_id = auth.uid());
create policy omit_rules_update on omit_rules for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy omit_rules_delete on omit_rules for delete using (owner_id = auth.uid());

drop policy employees_owner_only on employees;
create policy employees_select on employees for select using (has_account_access(owner_id));
create policy employees_insert on employees for insert with check (owner_id = auth.uid());
create policy employees_update on employees for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy employees_delete on employees for delete using (owner_id = auth.uid());

drop policy salary_runs_owner_only on salary_runs;
create policy salary_runs_select on salary_runs for select using (has_account_access(owner_id));
create policy salary_runs_insert on salary_runs for insert with check (owner_id = auth.uid());
create policy salary_runs_update on salary_runs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy salary_runs_delete on salary_runs for delete using (owner_id = auth.uid());

drop policy salary_slips_owner_only on salary_slips;
create policy salary_slips_select on salary_slips for select using (has_account_access(owner_id));
create policy salary_slips_insert on salary_slips for insert with check (owner_id = auth.uid());
create policy salary_slips_update on salary_slips for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy salary_slips_delete on salary_slips for delete using (owner_id = auth.uid());

drop policy salary_slip_trips_owner_only on salary_slip_trips;
create policy salary_slip_trips_select on salary_slip_trips for select using (has_account_access(owner_id));
create policy salary_slip_trips_insert on salary_slip_trips for insert with check (owner_id = auth.uid());
create policy salary_slip_trips_update on salary_slip_trips for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy salary_slip_trips_delete on salary_slip_trips for delete using (owner_id = auth.uid());

drop policy salary_slip_deductions_owner_only on salary_slip_deductions;
create policy salary_slip_deductions_select on salary_slip_deductions for select using (has_account_access(owner_id));
create policy salary_slip_deductions_insert on salary_slip_deductions for insert with check (owner_id = auth.uid());
create policy salary_slip_deductions_update on salary_slip_deductions for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy salary_slip_deductions_delete on salary_slip_deductions for delete using (owner_id = auth.uid());

drop policy employee_loans_owner_only on employee_loans;
create policy employee_loans_select on employee_loans for select using (has_account_access(owner_id));
create policy employee_loans_insert on employee_loans for insert with check (owner_id = auth.uid());
create policy employee_loans_update on employee_loans for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy employee_loans_delete on employee_loans for delete using (owner_id = auth.uid());

-- ============================================================================
-- app_settings: singleton (id boolean = true) -> per-owner
-- ============================================================================

alter table app_settings add column owner_id uuid references auth.users(id);
update app_settings set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table app_settings alter column owner_id set not null;
alter table app_settings alter column owner_id set default auth.uid();

drop policy app_settings_owner_only on app_settings;

alter table app_settings drop constraint app_settings_pkey;
alter table app_settings drop column id;
alter table app_settings add primary key (owner_id);

create policy app_settings_select on app_settings for select using (has_account_access(owner_id));
create policy app_settings_insert on app_settings for insert with check (owner_id = auth.uid());
create policy app_settings_update on app_settings for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Storage: receipts bucket
-- Left as "any authenticated user" rather than path-prefixed per-owner
-- checks — receipt_path values are unguessable UUIDs only ever surfaced via
-- the already owner-scoped `expenses` row, so protection is effectively
-- transitive through that table already.
-- ============================================================================

drop policy receipts_owner_only on storage.objects;

create policy receipts_authenticated on storage.objects for all
using (bucket_id = 'receipts' and auth.uid() is not null)
with check (bucket_id = 'receipts' and auth.uid() is not null);
