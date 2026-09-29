begin;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at before update on public.user_roles for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists trg_contact_rate_limits_updated_at on public.contact_rate_limits;
create trigger trg_contact_rate_limits_updated_at before update on public.contact_rate_limits for each row execute function public.set_updated_at();

create or replace function public.normalize_project_publish_state() returns trigger language plpgsql as $$
begin
  if new.published = true and (tg_op = 'INSERT' or old.published is distinct from true) then
    new.published_at = coalesce(new.published_at, now());
  elsif new.published = false then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_publish_state on public.projects;
create trigger trg_projects_publish_state before insert or update on public.projects for each row execute function public.normalize_project_publish_state();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.consume_contact_rate_limit(
  p_bucket_key text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_elapsed_seconds integer;
begin
  if p_bucket_key is null or char_length(p_bucket_key) < 8 then raise exception 'invalid rate limit bucket key'; end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid rate limit'; end if;
  if p_window_seconds < 60 or p_window_seconds > 86400 then raise exception 'invalid rate limit window'; end if;

  insert into public.contact_rate_limits (bucket_key, window_started_at, request_count)
  values (p_bucket_key, v_now, 1)
  on conflict (bucket_key) do update set
    window_started_at = case when public.contact_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now else public.contact_rate_limits.window_started_at end,
    request_count = case when public.contact_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1 else public.contact_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning public.contact_rate_limits.window_started_at, public.contact_rate_limits.request_count
  into v_window_started_at, v_request_count;

  v_elapsed_seconds := greatest(0, floor(extract(epoch from (v_now - v_window_started_at)))::integer);
  allowed := v_request_count <= p_limit;
  remaining := greatest(0, p_limit - v_request_count);
  retry_after_seconds := case when allowed then 0 else greatest(1, p_window_seconds - v_elapsed_seconds) end;
  return next;
end;
$$;
revoke all on function public.consume_contact_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_contact_rate_limit(text, integer, integer) to service_role;
commit;
