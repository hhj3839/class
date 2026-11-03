-- Restrict anonymous RPC access to the three token-based student survey operations.
-- Forward-only permission change: no function bodies, tables or application data change.
-- If a student regression is confirmed, restore only the affected token RPC grant in a
-- new forward migration; never restore blanket PUBLIC/anon access to teacher functions.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- PostgreSQL's global PUBLIC default is additive with per-schema grants.
-- Both layers must be removed for future postgres-owned application functions.
-- Existing Supabase-managed schemas and their existing functions are not altered.
alter default privileges for role postgres revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

revoke execute on all functions in schema public from public, anon;

grant execute on function public.get_roster_by_token(uuid) to anon, authenticated;
grant execute on function public.get_survey_month_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_response_by_token(uuid,integer,text,jsonb) to anon, authenticated;

do $verify$
declare
  allowed oid[] := array[
    'public.get_roster_by_token(uuid)'::regprocedure::oid,
    'public.get_survey_month_by_token(uuid)'::regprocedure::oid,
    'public.submit_response_by_token(uuid,integer,text,jsonb)'::regprocedure::oid
  ];
begin
  if exists (
    select 1 from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and has_function_privilege('anon',p.oid,'EXECUTE') is distinct from (p.oid=any(allowed))
  ) then
    raise exception 'ANONYMOUS_RPC_ALLOWLIST_MISMATCH';
  end if;
  if exists (
    select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and a.grantee=0 and a.privilege_type='EXECUTE'
  ) then
    raise exception 'PUBLIC_FUNCTION_EXECUTE_REMAINS';
  end if;
end
$verify$;

notify pgrst, 'reload schema';
commit;

