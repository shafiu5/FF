-- Extends collaborators from read-only to an optional edit tier.
-- has_account_access() (read) is unchanged: owner + any collaborator.
-- has_write_access() (insert/update/delete) is new: owner + only
-- collaborators explicitly marked can_edit.
--
-- The tricky part: when an editing collaborator inserts a row without
-- specifying owner_id, the column's old `default auth.uid()` would stamp
-- it with THEIR id, not the account they're editing on behalf of. Fixed by
-- pointing the default at my_effective_owner_id() instead, which resolves
-- to the account they edit for for if they're an editing collaborator, and
-- to their own id otherwise — so no app code needs to change.
--
-- Run after 0014_multi_tenant.sql. fuel-tracker's matching migration
-- (0008) must run after this one.

alter table account_collaborators add column can_edit boolean not null default false;

create or replace function my_effective_owner_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select owner_id from account_collaborators
     where can_edit = true
       and lower(collaborator_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     limit 1),
    auth.uid()
  )
$$;

create or replace function has_write_access(target_owner uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select target_owner = auth.uid()
    or exists (
      select 1 from account_collaborators
      where owner_id = target_owner
        and can_edit = true
        and lower(collaborator_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
$$;

-- One-off bootstrap: shafiu@furaaqu.com was previously a full co-owner
-- under the old shared-allowlist model and needs to keep adding/editing
-- data (fuel-tracker entries in particular), not just view it.
insert into account_collaborators (owner_id, collaborator_email, can_edit)
select id, 'shafiu@furaaqu.com', true from auth.users where lower(email) = 'shaafiu13@gmail.com'
on conflict (owner_id, collaborator_email) do update set can_edit = true;

alter table expenses alter column owner_id set default my_effective_owner_id();
drop policy expenses_insert on expenses;
drop policy expenses_update on expenses;
drop policy expenses_delete on expenses;
create policy expenses_insert on expenses for insert with check (has_write_access(owner_id));
create policy expenses_update on expenses for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy expenses_delete on expenses for delete using (has_write_access(owner_id));

alter table income_entries alter column owner_id set default my_effective_owner_id();
drop policy income_entries_insert on income_entries;
drop policy income_entries_update on income_entries;
drop policy income_entries_delete on income_entries;
create policy income_entries_insert on income_entries for insert with check (has_write_access(owner_id));
create policy income_entries_update on income_entries for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy income_entries_delete on income_entries for delete using (has_write_access(owner_id));

alter table income_entry_lines alter column owner_id set default my_effective_owner_id();
drop policy income_entry_lines_insert on income_entry_lines;
drop policy income_entry_lines_update on income_entry_lines;
drop policy income_entry_lines_delete on income_entry_lines;
create policy income_entry_lines_insert on income_entry_lines for insert with check (has_write_access(owner_id));
create policy income_entry_lines_update on income_entry_lines for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy income_entry_lines_delete on income_entry_lines for delete using (has_write_access(owner_id));

alter table omit_rules alter column owner_id set default my_effective_owner_id();
drop policy omit_rules_insert on omit_rules;
drop policy omit_rules_update on omit_rules;
drop policy omit_rules_delete on omit_rules;
create policy omit_rules_insert on omit_rules for insert with check (has_write_access(owner_id));
create policy omit_rules_update on omit_rules for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy omit_rules_delete on omit_rules for delete using (has_write_access(owner_id));

alter table employees alter column owner_id set default my_effective_owner_id();
drop policy employees_insert on employees;
drop policy employees_update on employees;
drop policy employees_delete on employees;
create policy employees_insert on employees for insert with check (has_write_access(owner_id));
create policy employees_update on employees for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy employees_delete on employees for delete using (has_write_access(owner_id));

alter table salary_runs alter column owner_id set default my_effective_owner_id();
drop policy salary_runs_insert on salary_runs;
drop policy salary_runs_update on salary_runs;
drop policy salary_runs_delete on salary_runs;
create policy salary_runs_insert on salary_runs for insert with check (has_write_access(owner_id));
create policy salary_runs_update on salary_runs for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy salary_runs_delete on salary_runs for delete using (has_write_access(owner_id));

alter table salary_slips alter column owner_id set default my_effective_owner_id();
drop policy salary_slips_insert on salary_slips;
drop policy salary_slips_update on salary_slips;
drop policy salary_slips_delete on salary_slips;
create policy salary_slips_insert on salary_slips for insert with check (has_write_access(owner_id));
create policy salary_slips_update on salary_slips for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy salary_slips_delete on salary_slips for delete using (has_write_access(owner_id));

alter table salary_slip_trips alter column owner_id set default my_effective_owner_id();
drop policy salary_slip_trips_insert on salary_slip_trips;
drop policy salary_slip_trips_update on salary_slip_trips;
drop policy salary_slip_trips_delete on salary_slip_trips;
create policy salary_slip_trips_insert on salary_slip_trips for insert with check (has_write_access(owner_id));
create policy salary_slip_trips_update on salary_slip_trips for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy salary_slip_trips_delete on salary_slip_trips for delete using (has_write_access(owner_id));

alter table salary_slip_deductions alter column owner_id set default my_effective_owner_id();
drop policy salary_slip_deductions_insert on salary_slip_deductions;
drop policy salary_slip_deductions_update on salary_slip_deductions;
drop policy salary_slip_deductions_delete on salary_slip_deductions;
create policy salary_slip_deductions_insert on salary_slip_deductions for insert with check (has_write_access(owner_id));
create policy salary_slip_deductions_update on salary_slip_deductions for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy salary_slip_deductions_delete on salary_slip_deductions for delete using (has_write_access(owner_id));

alter table employee_loans alter column owner_id set default my_effective_owner_id();
drop policy employee_loans_insert on employee_loans;
drop policy employee_loans_update on employee_loans;
drop policy employee_loans_delete on employee_loans;
create policy employee_loans_insert on employee_loans for insert with check (has_write_access(owner_id));
create policy employee_loans_update on employee_loans for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy employee_loans_delete on employee_loans for delete using (has_write_access(owner_id));

alter table app_settings alter column owner_id set default my_effective_owner_id();
drop policy app_settings_insert on app_settings;
drop policy app_settings_update on app_settings;
create policy app_settings_insert on app_settings for insert with check (has_write_access(owner_id));
create policy app_settings_update on app_settings for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
