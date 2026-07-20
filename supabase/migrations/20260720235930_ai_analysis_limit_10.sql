-- 파일럿 운영 중 새 AI 분석 한도를 월 5회에서 10회로 확대합니다.
-- 기존 분석 결과와 감사 로그는 삭제하지 않습니다.
create or replace function public.teacher_begin_ai_analysis_auth(p_class_id text,p_survey_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id uuid; call_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select count(*) into call_count from public.ai_analysis_runs
  where class_id=p_class_id and created_at>=date_trunc('month',now()) and status in('pending','complete');
  if call_count>=10 then raise exception '이번 달 AI 새 분석 한도(10회)를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  insert into public.ai_analysis_runs(class_id,teacher_id,survey_month)
  values(p_class_id,auth.uid(),p_survey_month) returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'ai_analysis_started','ai_analysis',new_id::text,jsonb_build_object('survey_month',p_survey_month));
  return new_id;
end;$$;

revoke all on function public.teacher_begin_ai_analysis_auth(text,date) from public;
grant execute on function public.teacher_begin_ai_analysis_auth(text,date) to authenticated;
