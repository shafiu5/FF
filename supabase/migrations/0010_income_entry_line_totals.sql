-- Per-entry aggregates over income_entry_lines.
--
-- Several pages were fetching every individual passenger-line row to the
-- client just to sum/count them. PostgREST caps unbounded selects at a
-- default row limit (1000 on this project) — once total line rows crossed
-- that cap, whichever entries' rows happened to fall outside the returned
-- window silently lost their tax-free breakdown and passenger counts,
-- while entries within the window kept working. That's why it looked like
-- "some imports" were broken and others weren't.
--
-- This view aggregates in the database instead, so the client only ever
-- fetches one row per income entry (far below the row cap) rather than one
-- row per passenger. Run after 0009_receipts_storage.sql.

create view income_entry_line_totals
with (security_invoker = true) as
select
  l.income_entry_id,
  e.vessel_id,
  e.income_date,
  count(*) as passenger_count,
  coalesce(sum(l.amount) filter (where l.is_tax_free), 0) as tax_free_amount,
  coalesce(sum(l.amount) filter (where not l.is_tax_free), 0) as taxable_amount
from income_entry_lines l
join income_entries e on e.id = l.income_entry_id
group by l.income_entry_id, e.vessel_id, e.income_date;
