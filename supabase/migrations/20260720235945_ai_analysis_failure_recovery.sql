-- AI 분석 시간 초과·중단 복구
-- 실패한 실행은 월간 10회 한도에서 제외하고, 오래된 pending 기록은 자동으로 failed 처리합니다.

alter table public.ai_analysis_runs
  add column if not exists error_message text not null default '';

create or replace function public.teacher_begin_ai_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; call_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;

  update public.ai_analysis_runs
  set status='failed',completed_at=now(),error_message='분석 실행이 중단되어 자동 종료되었습니다.'
  where class_id=p_class_id and teacher_id=auth.uid() and status='pending' and created_at<now()-interval '5 minutes';

  select count(*) into call_count
  from public.ai_analysis_runs
  where class_id=p_class_id and created_at>=date_trunc('month',now())
    and (status='complete' or (status='pending' and created_at>=now()-interval '5 minutes'));

  if call_count>=10 then raise exception '이번 달 AI 새 분석 한도(10회)를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month) values(p_class_id,auth.uid(),p_survey_month) returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'ai_analysis_started','ai_analysis',new_id::text,jsonb_build_object('survey_month',p_survey_month));
  return new_id;
end;$$;

create or replace function public.teacher_fail_ai_analysis_auth(p_class_id text,p_run_id uuid,p_request_id text,p_error_message text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.ai_analysis_runs
  set status='failed',request_id=coalesce(p_request_id,''),error_message=left(trim(coalesce(p_error_message,'')),500),completed_at=now()
  where id=p_run_id and class_id=p_class_id and teacher_id=auth.uid() and status='pending';
  if found then
    insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason)
    values(p_class_id,auth.uid(),'ai_analysis_failed','ai_analysis',p_run_id::text,left(trim(coalesce(p_error_message,'')),500));
  end if;
  return found;
end;$$;

revoke all on function public.teacher_begin_ai_analysis_auth(text,date) from public;
revoke all on function public.teacher_fail_ai_analysis_auth(text,uuid,text,text) from public;
grant execute on function public.teacher_begin_ai_analysis_auth(text,date) to authenticated;
grant execute on function public.teacher_fail_ai_analysis_auth(text,uuid,text,text) to authenticated;

