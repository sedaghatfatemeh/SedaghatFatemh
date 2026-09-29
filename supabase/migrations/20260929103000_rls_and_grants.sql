begin;
alter table public.user_roles enable row level security;
alter table public.projects enable row level security;
alter table public.contact_messages enable row level security;
alter table public.contact_rate_limits enable row level security;

revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.contact_messages from anon, authenticated;
revoke all on table public.contact_rate_limits from anon, authenticated;

grant select on table public.projects to anon, authenticated;
grant insert, update, delete on table public.projects to authenticated;
grant select on table public.user_roles to authenticated;
grant select on table public.contact_messages to authenticated;

drop policy if exists projects_public_read_published on public.projects;
create policy projects_public_read_published on public.projects for select to anon, authenticated using (published = true or public.is_admin());

drop policy if exists projects_admin_insert on public.projects;
create policy projects_admin_insert on public.projects for insert to authenticated with check (public.is_admin());

drop policy if exists projects_admin_update on public.projects;
create policy projects_admin_update on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists projects_admin_delete on public.projects;
create policy projects_admin_delete on public.projects for delete to authenticated using (public.is_admin());

drop policy if exists user_roles_self_or_admin_read on public.user_roles;
create policy user_roles_self_or_admin_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages for select to authenticated using (public.is_admin());
commit;
