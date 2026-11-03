-- One-time history reconciliation, audited against main 882fe77 on 2026-11-03.
-- This file is intentionally outside migrations/: no application DDL or data is replayed.
-- Run only after reviewing SUPABASE_AUDIT_20261103.md. Future catalog changes fail closed.
-- NULL statements mean history reconciliation, not a claim of executing the original SQL today.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table supabase_migrations.schema_migrations in share row exclusive mode;

do $audit$
begin
  if (select count(*) from supabase_migrations.schema_migrations where version in ('20260720090000','20260909120000','20260909150000','20260909160000','20260911150000','20260912100000')) <> 6 then
    raise exception 'RECONCILIATION_BLOCKED: original history is incomplete';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),replace(pg_get_functiondef(p.oid),chr(13),''),has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE'),exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) order by p.proname collate "C",pg_get_function_identity_arguments(p.oid) collate "C") from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f')::text) is distinct from 'd56f9dfcfad8d9b5c79bfadb4fa307ea' then
    raise exception 'RECONCILIATION_BLOCKED: functions changed since audit';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(table_name,column_name,case when table_name='survey_responses' and column_name='survey_month' then '<reviewed baseline default>' else column_default end,is_nullable,data_type,udt_name,is_identity,identity_generation) order by table_name collate "C",column_name collate "C") from information_schema.columns where table_schema='public' and table_name<>'ai_analysis_limit_overrides')::text) is distinct from 'eb210c25ff60032636105740a1277bdb' then
    raise exception 'RECONCILIATION_BLOCKED: columns changed since audit';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid),convalidated) order by conrelid::regclass::text collate "C",conname collate "C") from pg_constraint where connamespace='public'::regnamespace and contype<>'n' and conrelid::regclass::text<>'ai_analysis_limit_overrides')::text) is distinct from '038244e04c30412e12f8d8db55c249ab' then
    raise exception 'RECONCILIATION_BLOCKED: constraints changed since audit';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) order by indexname collate "C") from pg_indexes where schemaname='public' and tablename<>'ai_analysis_limit_overrides')::text) is distinct from '71b0cff6c510096610afb6ed8bc671ee' then
    raise exception 'RECONCILIATION_BLOCKED: indexes changed since audit';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled) order by tgname collate "C") from pg_trigger where not tgisinternal and tgrelid in(select oid from pg_class where relnamespace='public'::regnamespace))::text) is distinct from 'a24bb5f104c8d8e4c8f8270e52d48d35' then
    raise exception 'RECONCILIATION_BLOCKED: triggers changed since audit';
  end if;
  if md5((select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0)) order by c.relname collate "C") from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname<>'ai_analysis_limit_overrides')::text) is distinct from '86d1b1022e73db2cb31b2390a3fe871f' then
    raise exception 'RECONCILIATION_BLOCKED: tables changed since audit';
  end if;
  if exists(select 1 from pg_policies where schemaname='public') then
    raise exception 'RECONCILIATION_BLOCKED: unexpected RLS policy';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='survey_responses' and column_name='survey_month' and column_default is not null and column_default <> '(date_trunc(''month''::text, (CURRENT_DATE)::timestamp with time zone))::date') then
    raise exception 'RECONCILIATION_BLOCKED: unreviewed survey_month default';
  end if;
  if exists(select 1 from public.students where student_id is null)
     or exists(select 1 from public.survey_responses r join public.students s on s.class_id=r.class_id and s.student_number=r.student_number where r.student_id is null)
     or exists(select 1 from public.observations o join public.students s on s.class_id=o.class_id and s.student_number=o.student_number where o.student_id is null)
     or exists(select 1 from public.students where transferred_on is not null and active) then
    raise exception 'RECONCILIATION_BLOCKED: data invariant mismatch';
  end if;
  if exists(
    select 1 from supabase_migrations.schema_migrations m
    left join (values
    ('20260720090000','secure_teacher_context'),
    ('20260720150000','stable_student_ids'),
    ('20260720170000','ai_reports_backup'),
    ('20260720190000','secure_participation_pilot'),
    ('20260720210000','safe_cross_class_restore'),
    ('20260720230000','teacher_self_service_class'),
    ('20260720233000','observation_feedback_loop'),
    ('20260720234500','observation_soft_delete'),
    ('20260720235900','pilot_evidence_metrics'),
    ('20260720235930','ai_analysis_limit_10'),
    ('20260720235945','ai_analysis_failure_recovery'),
    ('20260720235960','idempotent_student_submissions'),
    ('20260720235970','safety_signal_inbox'),
    ('20260721090000','link_signals_to_observations'),
    ('20260722090000','signal_review_metrics'),
    ('20260722170000','relationship_ai_analysis'),
    ('20260723180000','remove_ai_analysis_limits'),
    ('20260723190000','year_end_cleanup'),
    ('20260723223000','update_year_end_cleanup_messages'),
    ('20260724140000','student_monthly_review_cycles'),
    ('20260724153000','disable_student_monthly_review_rpcs'),
    ('20260828090000','roll_demo_months_forward'),
    ('20260909120000','student_transfer_status'),
    ('20260909150000','student_coaching_cards'),
    ('20260909160000','student_coaching_limit_100'),
    ('20260911150000','coaching_backup_retention'),
    ('20260912100000','student_survey_only_coaching'),
    ('20260915120000','guest_lab_quota'),
    ('20260915140000','preserve_demo_ai_history'),
    ('20261005100000','survey_target_month')
    ) expected(version,name) on expected.version=m.version
    where expected.version is null or m.name is distinct from expected.name
  ) then
    raise exception 'RECONCILIATION_BLOCKED: unexpected history entry';
  end if;
end
$audit$;

insert into supabase_migrations.schema_migrations(version,name,statements)
values
  ('20260720150000','stable_student_ids',null),
  ('20260720170000','ai_reports_backup',null),
  ('20260720190000','secure_participation_pilot',null),
  ('20260720210000','safe_cross_class_restore',null),
  ('20260720230000','teacher_self_service_class',null),
  ('20260720233000','observation_feedback_loop',null),
  ('20260720234500','observation_soft_delete',null),
  ('20260720235900','pilot_evidence_metrics',null),
  ('20260720235930','ai_analysis_limit_10',null),
  ('20260720235945','ai_analysis_failure_recovery',null),
  ('20260720235960','idempotent_student_submissions',null),
  ('20260720235970','safety_signal_inbox',null),
  ('20260721090000','link_signals_to_observations',null),
  ('20260722090000','signal_review_metrics',null),
  ('20260722170000','relationship_ai_analysis',null),
  ('20260723180000','remove_ai_analysis_limits',null),
  ('20260723190000','year_end_cleanup',null),
  ('20260723223000','update_year_end_cleanup_messages',null),
  ('20260724140000','student_monthly_review_cycles',null),
  ('20260724153000','disable_student_monthly_review_rpcs',null),
  ('20260828090000','roll_demo_months_forward',null),
  ('20260915120000','guest_lab_quota',null),
  ('20260915140000','preserve_demo_ai_history',null),
  ('20261005100000','survey_target_month',null)
on conflict(version) do nothing
returning version,name;

commit;

