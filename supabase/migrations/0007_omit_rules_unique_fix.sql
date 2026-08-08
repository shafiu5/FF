-- The original unique constraint on omit_rules.reference assumed every
-- row had one. Now that Contact-only entries are allowed (reference left
-- blank, ''), multiple blank references collide on that constraint.
-- Replace it with partial unique indexes that only enforce uniqueness on
-- actual (non-empty) values. Run after 0006_line_tax_free.sql.

alter table omit_rules drop constraint omit_rules_reference_key;

create unique index omit_rules_reference_unique_idx on omit_rules (reference) where reference <> '';
create unique index omit_rules_contact_unique_idx on omit_rules (contact) where contact <> '';
