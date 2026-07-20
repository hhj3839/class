-- PRD F09/F10: AI 분석 근거에서 시작한 관찰 과제와 교사 확인 결과를 분리해 보존합니다.
alter table public.observations add column if not exists outcome text not null default 'pending';
alter table public.observations drop constraint if exists observations_outcome_check;
alter table public.observations add constraint observations_outcome_check check(outcome in('pending','continue','support','no_issue'));
alter table public.observations add column if not exists ai_run_id uuid references public.ai_analysis_runs(id) on delete set null;
alter table public.observations add column if not exists source_type text not null default 'manual';
alter table public.observations drop constraint if exists observations_source_type_check;
alter table public.observations add constraint observations_source_type_check check(source_type in('manual','rule_signal','ai_analysis','relationship_analysis'));
alter table public.observations add column if not exists source_snapshot jsonb not null default '{}'::jsonb;
create index if not exists observations_ai_run_idx on public.observations(ai_run_id) where ai_run_id is not null;

create or replace function public.teacher_save_observation_auth(p_class_id text,p_observation jsonb)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  saved_id uuid:=coalesce(nullif(p_observation->>'id','')::uuid,gen_random_uuid());
  saved_status text:=coalesce(nullif(p_observation->>'status',''),'todo');
  saved_outcome text:=coalesce(nullif(p_observation->>'outcome',''),'pending');
  saved_source_type text:=coalesce(nullif(p_observation->>'sourceType',''),'manual');
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if saved_status not in('todo','doing','done') then raise exception '올바르지 않은 관찰 진행 상태입니다.'; end if;
  if saved_outcome not in('pending','continue','support','no_issue') then raise exception '올바르지 않은 관찰 확인 결과입니다.'; end if;
  if saved_status='done' and trim(coalesce(p_observation->>'observedFact',''))='' then raise exception '확인 완료 시에는 확인한 사실이 필요합니다.'; end if;
  if saved_status='done' and saved_outcome='pending' then raise exception '확인 완료 시에는 확인 결과가 필요합니다.'; end if;

  insert into public.observations(id,class_id,student_number,survey_month,title,planned_action,observed_fact,teacher_interpretation,interview_note,follow_up,follow_up_date,status,outcome,ai_run_id,source_type,source_snapshot,updated_at)
  values(saved_id,p_class_id,(p_observation->>'studentNumber')::integer,nullif(p_observation->>'surveyMonth','')::date,p_observation->>'title',coalesce(p_observation->>'plannedAction',''),coalesce(p_observation->>'observedFact',''),coalesce(p_observation->>'teacherInterpretation',''),coalesce(p_observation->>'interviewNote',''),coalesce(p_observation->>'followUp',''),nullif(p_observation->>'followUpDate','')::date,saved_status,saved_outcome,nullif(p_observation->>'aiRunId','')::uuid,saved_source_type,coalesce(p_observation->'sourceSnapshot','{}'::jsonb),now())
  on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,follow_up_date=excluded.follow_up_date,status=excluded.status,outcome=excluded.outcome,ai_run_id=excluded.ai_run_id,source_type=excluded.source_type,source_snapshot=excluded.source_snapshot,updated_at=now()
  where observations.class_id=p_class_id;

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'observation_saved','observation',saved_id::text,jsonb_build_object('status',saved_status,'outcome',saved_outcome,'source_type',saved_source_type,'ai_run_id',p_observation->>'aiRunId'));
  return saved_id;
end;
$$;

revoke all on function public.teacher_save_observation_auth(text,jsonb) from public;
grant execute on function public.teacher_save_observation_auth(text,jsonb) to authenticated;
