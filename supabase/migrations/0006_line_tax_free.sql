-- Tracks tax-free status per passenger/line, not just per income entry, so
-- a "whole file" import with a mixed set of tax-free and taxable passengers
-- can be taxed correctly instead of taxing the tax-free portion too.
-- Run after 0005_omit_contact.sql.

alter table income_entry_lines add column is_tax_free boolean not null default false;
