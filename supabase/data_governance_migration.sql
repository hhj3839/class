-- 우리반 이음: 삭제·정정·감사 로그·보존 정책
-- 영구 삭제는 자동 실행하지 않으며, 모든 변경은 교사 로그인과 담당 학급 권한을 확인합니다.

alter table public.survey_responses add column if not exists analysis_excluded boolean not null default false;
alter table public.survey_responses add column if not exists correction_note text not null default '';
alter table public.survey_responses add column if not exists deleted_at timestamptz;
alter table public.survey_responses add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  class_id text not null references public.classes(class_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_class_time_idx on public.audit_logs(class_id,created_at desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon,authenticated;

create table if not exists public.data_retention_policies (
  class_id text primary key references public.classes(class_id) on delete cascade,
  retention_months integer not null default 12 check(retention_months between 1 and 120),
  end_of_year_action text not null default 'review' check(end_of_year_action in('review','anonymize','delete')),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.data_retention_policies enable row level security;
revoke all on public.data_retention_policies from anon,authenticated;

drop function if exists public.teacher_get_responses_auth(text);
create function public.teacher_get_responses_auth(p_class_id text)
returns table(id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb,analysis_excluded boolean,correction_note text)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select r.id,r.student_number,r.student_name,r.survey_month,r.submitted_at,r.payload_json,r.analysis_excluded,r.correction_note from public.survey_responses r where r.class_id=p_class_id and r.deleted_at is null order by r.submitted_at desc;
end;
$$;

create or replace function public.teacher_set_response_status_auth(p_class_id text,p_response_id uuid,p_excluded boolean,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.survey_responses set analysis_excluded=p_excluded,correction_note=trim(coalesce(p_reason,'')) where id=p_response_id and class_id=p_class_id and deleted_at is null;
  if not found then raise exception '대상 응답을 찾을 수 없습니다.'; end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason,details) values(p_class_id,auth.uid(),case when p_excluded then 'analysis_exclude' else 'analysis_restore' end,'survey_response',p_response_id::text,trim(coalesce(p_reason,'')),jsonb_build_object('excluded',p_excluded));
  return true;
end;
$$;

create or replace function public.teacher_soft_delete_response_auth(p_class_id text,p_response_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.survey_responses set deleted_at=now(),deleted_by=auth.uid(),correction_note=trim(coalesce(p_reason,'')) where id=p_response_id and class_id=p_class_id and deleted_at is null;
  if not found then raise exception '대상 응답을 찾을 수 없습니다.'; end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason) values(p_class_id,auth.uid(),'soft_delete','survey_response',p_response_id::text,trim(coalesce(p_reason,'')));
  return true;
end;
$$;

create or replace function public.teacher_get_audit_logs_auth(p_class_id text,p_limit integer default 50)
returns table(id bigint,action text,target_type text,target_id text,reason text,details jsonb,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select a.id,a.action,a.target_type,a.target_id,a.reason,a.details,a.created_at from public.audit_logs a where a.class_id=p_class_id order by a.created_at desc limit least(greatest(p_limit,1),200);
end;
$$;

create or replace function public.teacher_set_retention_policy_auth(p_class_id text,p_retention_months integer,p_end_of_year_action text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  insert into public.data_retention_policies(class_id,retention_months,end_of_year_action,updated_by,updated_at) values(p_class_id,p_retention_months,p_end_of_year_action,auth.uid(),now())
  on conflict(class_id) do update set retention_months=excluded.retention_months,end_of_year_action=excluded.end_of_year_action,updated_by=excluded.updated_by,updated_at=now();
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'retention_policy_update','class',p_class_id,jsonb_build_object('retention_months',p_retention_months,'end_of_year_action',p_end_of_year_action));
  return true;
end;
$$;

create or replace function public.teacher_get_retention_policy_auth(p_class_id text)
returns table(retention_months integer,end_of_year_action text,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select p.retention_months,p.end_of_year_action,p.updated_at from public.data_retention_policies p where p.class_id=p_class_id;
end;
$$;

revoke all on function public.teacher_get_responses_auth(text) from public;
revoke all on function public.teacher_set_response_status_auth(text,uuid,boolean,text) from public;
revoke all on function public.teacher_soft_delete_response_auth(text,uuid,text) from public;
revoke all on function public.teacher_get_audit_logs_auth(text,integer) from public;
revoke all on function public.teacher_set_retention_policy_auth(text,integer,text) from public;
revoke all on function public.teacher_get_retention_policy_auth(text) from public;
grant execute on function public.teacher_get_responses_auth(text) to authenticated;
grant execute on function public.teacher_set_response_status_auth(text,uuid,boolean,text) to authenticated;
grant execute on function public.teacher_soft_delete_response_auth(text,uuid,text) to authenticated;
grant execute on function public.teacher_get_audit_logs_auth(text,integer) to authenticated;
grant execute on function public.teacher_set_retention_policy_auth(text,integer,text) to authenticated;
grant execute on function public.teacher_get_retention_policy_auth(text) to authenticated;
