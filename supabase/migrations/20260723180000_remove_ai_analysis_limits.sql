-- 학급 AI 분석과 관계 AI 분석의 월별 새 분석 횟수 제한을 제거합니다.
-- 중단된 pending 실행 정리, 담당 교사 권한 검사, 실행 기록과 감사 로그는 유지합니다.

create or replace function public.teacher_begin_ai_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  update public.ai_analysis_runs
  set status='failed',completed_at=now(),error_message='분석 실행이 중단되어 자동 종료되었습니다.'
  where class_id=p_class_id and teacher_id=auth.uid() and analysis_type='class'
    and status='pending' and created_at<now()-interval '5 minutes';
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month,analysis_type)
  values(p_class_id,auth.uid(),p_survey_month,'class') returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'ai_analysis_started','ai_analysis',new_id::text,
    jsonb_build_object('survey_month',p_survey_month,'analysis_type','class','monthly_limit','none'));
  return new_id;
end;$$;

create or replace function public.teacher_begin_relationship_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  update public.ai_analysis_runs
  set status='failed',completed_at=now(),error_message='관계 분석 실행이 중단되어 자동 종료되었습니다.'
  where class_id=p_class_id and teacher_id=auth.uid() and analysis_type='relationship'
    and status='pending' and created_at<now()-interval '5 minutes';
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month,analysis_type)
  values(p_class_id,auth.uid(),p_survey_month,'relationship') returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'ai_analysis_started','relationship_analysis',new_id::text,
    jsonb_build_object('survey_month',p_survey_month,'analysis_type','relationship','monthly_limit','none'));
  return new_id;
end;$$;

revoke all on function public.teacher_begin_ai_analysis_auth(text,date) from public;
revoke all on function public.teacher_begin_relationship_analysis_auth(text,date) from public;
grant execute on function public.teacher_begin_ai_analysis_auth(text,date) to authenticated;
grant execute on function public.teacher_begin_relationship_analysis_auth(text,date) to authenticated;
