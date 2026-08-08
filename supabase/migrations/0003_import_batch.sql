-- Tags each row inserted by one Excel import run with a shared id, so a
-- bad import (wrong file) can be undone in one delete instead of row by row.
-- Run after 0002_tax.sql.

alter table income_entries add column import_batch_id uuid;

create index income_entries_import_batch_idx on income_entries(import_batch_id);
