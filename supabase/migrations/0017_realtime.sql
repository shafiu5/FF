-- Live updates: adds the tables the app watches to Supabase's realtime
-- publication so an open page refreshes the moment a change is made from
-- any device. RLS still applies — each subscriber only receives changes to
-- rows they're allowed to read. Safe to re-run: tables already in the
-- publication are skipped. Includes vessels/fuel_entries/deliveries from
-- fuel-tracker, since fuel costs shown here are derived from them.
-- Run after 0016_my_collaboration.sql.

do $$
declare
  t text;
begin
  foreach t in array array[
    'expenses',
    'income_entries',
    'income_entry_lines',
    'omit_rules',
    'app_settings',
    'employees',
    'employee_loans',
    'salary_runs',
    'salary_slips',
    'salary_slip_trips',
    'salary_slip_deductions',
    'vessels',
    'fuel_entries',
    'deliveries'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
