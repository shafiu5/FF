-- Lets an omit-list entry also be saved as a contact number, not just a
-- reference/invoice number — some import files only have a Contact column.
-- Matching checks both fields. Run after 0004_income_entry_lines.sql.

alter table omit_rules add column contact text not null default '';
