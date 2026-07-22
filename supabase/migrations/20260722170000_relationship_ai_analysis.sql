-- 학급 생활 분석과 누적 관계 분석의 캐시·호출 한도를 분리합니다.
alter table public.ai_analysis_runs
  add column if not exists analysis_type text not null default 'class';

alter table public.ai_analysis_runs drop constraint if exists ai_analysis_runs_analysis_type_check;
alter table public.ai_analysis_runs add constraint ai_analysis_runs_analysis_type_check
  check(analysis_type in('class','relationship'));

create index if not exists ai_analysis_runs_type_cache_idx
  on public.ai_analysis_runs(class_id,analysis_type,survey_month,created_at desc);

create or replace function public.teacher_get_cached_ai_analysis_auth(p_class_id text,p_survey_month date)
returns table(id uuid,result_json jsonb,model text,response_count integer,review_status text,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select a.id,a.result_json,a.model,a.response_count,a.review_status,a.created_at
  from public.ai_analysis_runs a
  where a.class_id=p_class_id and a.analysis_type='class' and a.survey_month=p_survey_month
    and a.status='complete' and a.review_status<>'hidden'
  order by a.created_at desc limit 1;
end;$$;

create or replace function public.teacher_begin_ai_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; call_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.ai_analysis_runs set status='failed',completed_at=now(),error_message='분석 실행이 중단되어 자동 종료되었습니다.'
  where class_id=p_class_id and teacher_id=auth.uid() and analysis_type='class' and status='pending' and created_at<now()-interval '5 minutes';
  select count(*) into call_count from public.ai_analysis_runs
  where class_id=p_class_id and analysis_type='class' and created_at>=date_trunc('month',now())
    and (status='complete' or (status='pending' and created_at>=now()-interval '5 minutes'));
  if call_count>=10 then raise exception '이번 달 학급 AI 새 분석 한도(10회)를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month,analysis_type)
  values(p_class_id,auth.uid(),p_survey_month,'class') returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'ai_analysis_started','ai_analysis',new_id::text,jsonb_build_object('survey_month',p_survey_month,'analysis_type','class'));
  return new_id;
end;$$;

create or replace function public.teacher_get_cached_relationship_analysis_auth(p_class_id text,p_survey_month date)
returns table(id uuid,result_json jsonb,model text,response_count integer,review_status text,created_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select a.id,a.result_json,a.model,a.response_count,a.review_status,a.created_at
  from public.ai_analysis_runs a
  where a.class_id=p_class_id and a.analysis_type='relationship' and a.survey_month=p_survey_month
    and a.status='complete' and a.review_status<>'hidden'
  order by a.created_at desc limit 1;
end;$$;

create or replace function public.teacher_begin_relationship_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; call_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.ai_analysis_runs set status='failed',completed_at=now(),error_message='관계 분석 실행이 중단되어 자동 종료되었습니다.'
  where class_id=p_class_id and teacher_id=auth.uid() and analysis_type='relationship' and status='pending' and created_at<now()-interval '5 minutes';
  select count(*) into call_count from public.ai_analysis_runs
  where class_id=p_class_id and analysis_type='relationship' and created_at>=date_trunc('month',now())
    and (status='complete' or (status='pending' and created_at>=now()-interval '5 minutes'));
  if call_count>=10 then raise exception '이번 달 관계 AI 새 분석 한도(10회)를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month,analysis_type)
  values(p_class_id,auth.uid(),p_survey_month,'relationship') returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'ai_analysis_started','relationship_analysis',new_id::text,jsonb_build_object('survey_month',p_survey_month,'analysis_type','relationship'));
  return new_id;
end;$$;

revoke all on function public.teacher_get_cached_relationship_analysis_auth(text,date) from public;
revoke all on function public.teacher_begin_relationship_analysis_auth(text,date) from public;
grant execute on function public.teacher_get_cached_relationship_analysis_auth(text,date) to authenticated;
grant execute on function public.teacher_begin_relationship_analysis_auth(text,date) to authenticated;
