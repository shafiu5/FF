-- Lets the currently logged-in user look up their own collaboration status
-- (which account, if any, they're a collaborator on) for display in the
-- new Settings > Profile section. A collaborator can't otherwise SELECT
-- account_collaborators directly (that table's RLS only allows the owner
-- to read their own invite list), so this is security definer, scoped to
-- rows matching the caller's own JWT email only.
-- Run after 0015_collaborator_edit_access.sql.

create or replace function my_collaboration()
returns table (owner_email text, can_edit boolean)
language sql stable security definer set search_path = public
as $$
  select u.email, ac.can_edit
  from account_collaborators ac
  join auth.users u on u.id = ac.owner_id
  where lower(ac.collaborator_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
