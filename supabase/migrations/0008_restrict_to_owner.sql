-- Restricts every vessel-finance table to only these two email addresses,
-- instead of "any authenticated user". Even if someone else ever creates
-- an account on the shared Supabase project, they get zero access here.
-- Run after 0007_omit_rules_unique_fix.sql.

create or replace function is_owner() returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('shaafiu13@gmail.com', 'shafiu@furaaqu.com')
$$;

drop policy expenses_all on expenses;
drop policy income_entries_all on income_entries;
drop policy omit_rules_all on omit_rules;
drop policy app_settings_all on app_settings;
drop policy income_entry_lines_all on income_entry_lines;

create policy expenses_owner_only on expenses for all
using (is_owner()) with check (is_owner());

create policy income_entries_owner_only on income_entries for all
using (is_owner()) with check (is_owner());

create policy omit_rules_owner_only on omit_rules for all
using (is_owner()) with check (is_owner());

create policy app_settings_owner_only on app_settings for all
using (is_owner()) with check (is_owner());

create policy income_entry_lines_owner_only on income_entry_lines for all
using (is_owner()) with check (is_owner());
