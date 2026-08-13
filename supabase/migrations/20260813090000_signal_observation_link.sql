-- PRD v1.2 P1: 안전 신호와 관찰 기록을 하나의 확인 업무로 연결합니다.
alter table public.observations add column if not exists signal_review_id uuid references public.safety_signal_reviews(id) on delete set null;
create unique index if not exists observations_active_signal_review_key on public.observations(class_id,signal_review_id) where signal_review_id is not null and deleted_at is null;

drop function if exists public.teacher_get_observations_auth(text);
create function public.teacher_get_observations_auth(p_class_id text)
returns table(id uuid,student_id uuid,student_number integer,survey_month date,title text,planned_action text,observed_fact text,teacher_interpretation text,interview_note text,follow_up text,follow_up_date date,status text,outcome text,ai_run_id uuid,source_type text,source_snapshot jsonb,signal_review_id uuid,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select o.id,o.student_id,o.student_number,o.survey_month,o.title,o.planned_action,o.observed_fact,o.teacher_interpretation,o.interview_note,o.follow_up,o.follow_up_date,o.status,o.outcome,o.ai_run_id,o.source_type,o.source_snapshot,o.signal_review_id,o.updated_at from public.observations o where o.class_id=p_class_id and o.deleted_at is null order by o.updated_at desc;
end;
$$;

create or replace function public.teacher_save_observation_auth(p_class_id text,p_observation jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare saved_id uuid:=coalesce(nullif(p_observation->>'id','')::uuid,gen_random_uuid());saved_status text:=coalesce(nullif(p_observation->>'status',''),'todo');saved_outcome text:=coalesce(nullif(p_observation->>'outcome',''),'pending');saved_source_type text:=coalesce(nullif(p_observation->>'sourceType',''),'manual');saved_signal_id uuid:=nullif(p_observation->>'signalReviewId','')::uuid;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if saved_status not in('todo','doing','done') or saved_outcome not in('pending','continue','support','no_issue') then raise exception '올바르지 않은 관찰 상태입니다.'; end if;
  if saved_status='done' and trim(coalesce(p_observation->>'observedFact',''))='' then raise exception '확인 완료 시에는 확인한 사실이 필요합니다.'; end if;
  if saved_status='done' and saved_outcome='pending' then raise exception '확인 완료 시에는 확인 결과가 필요합니다.'; end if;
  if saved_signal_id is not null and not exists(select 1 from public.safety_signal_reviews s where s.id=saved_signal_id and s.class_id=p_class_id) then raise exception '연결할 안전 신호를 찾을 수 없습니다.'; end if;
  insert into public.observations(id,class_id,student_number,survey_month,title,planned_action,observed_fact,teacher_interpretation,interview_note,follow_up,follow_up_date,status,outcome,ai_run_id,source_type,source_snapshot,signal_review_id,updated_at)
  values(saved_id,p_class_id,(p_observation->>'studentNumber')::integer,nullif(p_observation->>'surveyMonth','')::date,p_observation->>'title',coalesce(p_observation->>'plannedAction',''),coalesce(p_observation->>'observedFact',''),coalesce(p_observation->>'teacherInterpretation',''),coalesce(p_observation->>'interviewNote',''),coalesce(p_observation->>'followUp',''),nullif(p_observation->>'followUpDate','')::date,saved_status,saved_outcome,nullif(p_observation->>'aiRunId','')::uuid,saved_source_type,coalesce(p_observation->'sourceSnapshot','{}'::jsonb),saved_signal_id,now())
  on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,follow_up_date=excluded.follow_up_date,status=excluded.status,outcome=excluded.outcome,source_snapshot=excluded.source_snapshot,signal_review_id=excluded.signal_review_id,updated_at=now() where observations.class_id=p_class_id;
  if saved_signal_id is not null then
    update public.safety_signal_reviews set status=case when saved_status='done' and saved_outcome='support' then 'support_connected' when saved_status='done' and saved_outcome='no_issue' then 'no_issue' when saved_status='done' then 'closed' when saved_status='doing' then 'fact_checking' else 'conversation_planned' end,follow_up_date=nullif(p_observation->>'followUpDate','')::date,updated_by=auth.uid(),updated_at=now() where id=saved_signal_id and class_id=p_class_id;
  end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'observation_saved','observation',saved_id::text,jsonb_build_object('status',saved_status,'outcome',saved_outcome,'signal_review_id',saved_signal_id));return saved_id;
end;
$$;
revoke all on function public.teacher_get_observations_auth(text) from public;
revoke all on function public.teacher_save_observation_auth(text,jsonb) from public;
grant execute on function public.teacher_get_observations_auth(text) to authenticated;
grant execute on function public.teacher_save_observation_auth(text,jsonb) to authenticated;
