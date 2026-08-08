-- Storage bucket for receipt/invoice photos attached to expenses.
-- Private bucket — access is via signed URLs generated for the owner only,
-- reusing the same is_owner() check as every other table. Run after
-- 0008_restrict_to_owner.sql.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

alter table expenses add column receipt_path text;

create policy receipts_owner_only on storage.objects for all
using (bucket_id = 'receipts' and is_owner())
with check (bucket_id = 'receipts' and is_owner());
