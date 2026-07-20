-- 2차 개선: AI 결과 캐시·호출 제한·교사 검토, 학급 백업·복구
create table if not exists public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  survey_month date not null,
  model text not null default '',
  response_count integer not null default 0,
  status text not null default 'pending' check(status in('pending','complete','failed')),
  review_status text not null default 'active' check(review_status in('active','flagged','hidden')),
  review_note text not null default '',
  result_json jsonb not null default '{}'::jsonb,
  request_id text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists ai_analysis_runs_class_month_idx on public.ai_analysis_runs(class_id,survey_month,created_at desc);
alter table public.ai_analysis_runs enable row level security;
revoke all on public.ai_analysis_runs from anon,authenticated;

create or replace function public.teacher_get_cached_ai_analysis_auth(p_class_id text,p_survey_month date)
returns table(id uuid,result_json jsonb,model text,response_count integer,review_status text,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select a.id,a.result_json,a.model,a.response_count,a.review_status,a.created_at from public.ai_analysis_runs a
  where a.class_id=p_class_id and a.survey_month=p_survey_month and a.status='complete' and a.review_status<>'hidden'
  order by a.created_at desc limit 1;
end;$$;

create or replace function public.teacher_begin_ai_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; call_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select count(*) into call_count from public.ai_analysis_runs where class_id=p_class_id and created_at>=date_trunc('month',now()) and status in('pending','complete');
  if call_count>=5 then raise exception '이번 달 AI 새 분석 한도(5회)를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month) values(p_class_id,auth.uid(),p_survey_month) returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'ai_analysis_started','ai_analysis',new_id::text,jsonb_build_object('survey_month',p_survey_month));
  return new_id;
end;$$;

create or replace function public.teacher_complete_ai_analysis_auth(p_class_id text,p_run_id uuid,p_result jsonb,p_model text,p_response_count integer,p_request_id text default '')
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.ai_analysis_runs set result_json=p_result,model=p_model,response_count=p_response_count,request_id=coalesce(p_request_id,''),status='complete',completed_at=now()
  where id=p_run_id and class_id=p_class_id and teacher_id=auth.uid() and status='pending';
  if not found then raise exception 'AI 분석 실행 기록을 찾을 수 없습니다.'; end if;
  return true;
end;$$;

create or replace function public.teacher_fail_ai_analysis_auth(p_class_id text,p_run_id uuid,p_request_id text default '')
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.ai_analysis_runs set status='failed',request_id=coalesce(p_request_id,''),completed_at=now() where id=p_run_id and class_id=p_class_id and teacher_id=auth.uid();return found;end;$$;

create or replace function public.teacher_review_ai_analysis_auth(p_class_id text,p_run_id uuid,p_status text,p_note text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_status not in('active','flagged','hidden') then raise exception 'AI 검토 상태가 올바르지 않습니다.'; end if;
  update public.ai_analysis_runs set review_status=p_status,review_note=trim(coalesce(p_note,'')) where id=p_run_id and class_id=p_class_id and teacher_id=auth.uid() and status='complete';
  if not found then raise exception 'AI 분석 결과를 찾을 수 없습니다.'; end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason,details) values(p_class_id,auth.uid(),'ai_analysis_review','ai_analysis',p_run_id::text,trim(coalesce(p_note,'')),jsonb_build_object('status',p_status));
  return true;
end;$$;

create or replace function public.teacher_export_class_backup_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object('format','class-ieum-backup-v1','exportedAt',now(),'classId',p_class_id,
    'students',coalesce((select jsonb_agg(to_jsonb(s) order by s.student_number) from public.students s where s.class_id=p_class_id),'[]'::jsonb),
    'responses',coalesce((select jsonb_agg(to_jsonb(r) order by r.submitted_at) from public.survey_responses r where r.class_id=p_class_id),'[]'::jsonb),
    'observations',coalesce((select jsonb_agg(to_jsonb(o) order by o.updated_at) from public.observations o where o.class_id=p_class_id),'[]'::jsonb)
  ) into result;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id) values(p_class_id,auth.uid(),'backup_export','class',p_class_id);
  return result;
end;$$;

create or replace function public.teacher_restore_class_backup_auth(p_class_id text,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student_count integer:=0;response_count integer:=0;observation_count integer:=0;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if p_backup->>'format'<>'class-ieum-backup-v1' then raise exception '지원하지 않는 백업 형식입니다.'; end if;
  insert into public.students(class_id,student_number,student_name,active,student_id)
  select p_class_id,x.student_number,x.student_name,x.active,coalesce(x.student_id,gen_random_uuid()) from jsonb_to_recordset(coalesce(p_backup->'students','[]'::jsonb)) as x(student_id uuid,student_number integer,student_name text,active boolean)
  where x.student_number is not null and trim(coalesce(x.student_name,''))<>''
  on conflict(class_id,student_number) do update set student_name=excluded.student_name,active=excluded.active;
  get diagnostics student_count=row_count;
  insert into public.survey_responses(id,class_id,student_id,student_number,student_name,survey_month,submitted_at,payload_json,analysis_excluded,correction_note,deleted_at,deleted_by)
  select x.id,p_class_id,s.student_id,x.student_number,x.student_name,x.survey_month,x.submitted_at,x.payload_json,coalesce(x.analysis_excluded,false),coalesce(x.correction_note,''),x.deleted_at,null
  from jsonb_to_recordset(coalesce(p_backup->'responses','[]'::jsonb)) as x(id uuid,student_id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb,analysis_excluded boolean,correction_note text,deleted_at timestamptz)
  left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
  on conflict(id) do update set payload_json=excluded.payload_json,analysis_excluded=excluded.analysis_excluded,correction_note=excluded.correction_note,deleted_at=excluded.deleted_at where survey_responses.class_id=p_class_id;
  get diagnostics response_count=row_count;
  insert into public.observations(id,class_id,student_id,student_number,survey_month,title,planned_action,observed_fact,teacher_interpretation,interview_note,follow_up,follow_up_date,status,updated_at)
  select x.id,p_class_id,s.student_id,x.student_number,x.survey_month,x.title,coalesce(x.planned_action,''),coalesce(x.observed_fact,''),coalesce(x.teacher_interpretation,''),coalesce(x.interview_note,''),coalesce(x.follow_up,''),x.follow_up_date,coalesce(x.status,'todo'),coalesce(x.updated_at,now())
  from jsonb_to_recordset(coalesce(p_backup->'observations','[]'::jsonb)) as x(id uuid,student_id uuid,student_number integer,survey_month date,title text,planned_action text,observed_fact text,teacher_interpretation text,interview_note text,follow_up text,follow_up_date date,status text,updated_at timestamptz)
  left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
  on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,follow_up_date=excluded.follow_up_date,status=excluded.status,updated_at=excluded.updated_at where observations.class_id=p_class_id;
  get diagnostics observation_count=row_count;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'backup_restore','class',p_class_id,jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count));
  return jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count);
end;$$;

revoke all on function public.teacher_get_cached_ai_analysis_auth(text,date) from public;
revoke all on function public.teacher_begin_ai_analysis_auth(text,date) from public;
revoke all on function public.teacher_complete_ai_analysis_auth(text,uuid,jsonb,text,integer,text) from public;
revoke all on function public.teacher_fail_ai_analysis_auth(text,uuid,text) from public;
revoke all on function public.teacher_review_ai_analysis_auth(text,uuid,text,text) from public;
revoke all on function public.teacher_export_class_backup_auth(text) from public;
revoke all on function public.teacher_restore_class_backup_auth(text,jsonb) from public;
grant execute on function public.teacher_get_cached_ai_analysis_auth(text,date) to authenticated;
grant execute on function public.teacher_begin_ai_analysis_auth(text,date) to authenticated;
grant execute on function public.teacher_complete_ai_analysis_auth(text,uuid,jsonb,text,integer,text) to authenticated;
grant execute on function public.teacher_fail_ai_analysis_auth(text,uuid,text) to authenticated;
grant execute on function public.teacher_review_ai_analysis_auth(text,uuid,text,text) to authenticated;
grant execute on function public.teacher_export_class_backup_auth(text) to authenticated;
grant execute on function public.teacher_restore_class_backup_auth(text,jsonb) to authenticated;
