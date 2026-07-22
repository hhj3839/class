-- 학급 지원 환류 지표에 안전 신호 확인·처리 현황을 포함합니다.
drop function if exists public.teacher_get_pilot_metrics_auth(text);
create function public.teacher_get_pilot_metrics_auth(p_class_id text)
returns table(
  latest_month date,
  roster_count integer,
  latest_participants integer,
  latest_participation_rate numeric,
  average_completion_seconds numeric,
  ai_run_count integer,
  ai_recommendation_count integer,
  ai_review_count integer,
  ai_helpful_count integer,
  observation_count integer,
  observation_done_count integer,
  observation_support_count integer,
  observation_no_issue_count integer,
  signal_review_count integer,
  signal_review_checked_count integer,
  signal_review_resolved_count integer
) language plpgsql security definer set search_path=public,pg_temp
as $$
declare target_month date;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select max(r.survey_month) into target_month from public.survey_responses r where r.class_id=p_class_id and r.deleted_at is null;
  return query
  with active_students as (
    select count(*)::integer count from public.students s where s.class_id=p_class_id and s.active
  ), latest as (
    select distinct on(coalesce(r.student_id::text,r.student_number::text)) r.* from public.survey_responses r
    where r.class_id=p_class_id and r.survey_month=target_month and r.deleted_at is null
    order by coalesce(r.student_id::text,r.student_number::text),r.submitted_at desc
  ), ai as (
    select count(*)::integer runs,
      coalesce(sum(jsonb_array_length(coalesce(a.result_json->'priority_students','[]'::jsonb))),0)::integer recommendations,
      count(*) filter(where a.usefulness<>'unreviewed')::integer reviews,
      count(*) filter(where a.usefulness='helpful')::integer helpful
    from public.ai_analysis_runs a where a.class_id=p_class_id and a.status='complete'
  ), observation as (
    select count(*)::integer total,
      count(*) filter(where o.status='done')::integer done,
      count(*) filter(where o.outcome='support')::integer support,
      count(*) filter(where o.outcome='no_issue')::integer no_issue
    from public.observations o where o.class_id=p_class_id and o.deleted_at is null
  ), signal_review as (
    select count(*)::integer total,
      count(*) filter(where s.status<>'unreviewed')::integer checked,
      count(*) filter(where s.status in('support_connected','no_issue','closed'))::integer resolved
    from public.safety_signal_reviews s where s.class_id=p_class_id
  )
  select target_month,a.count,count(l.id)::integer,
    case when a.count>0 then round(count(l.id)::numeric/a.count*100,1) else 0 end,
    round(avg(case when l.payload_json->>'completionSeconds' ~ '^[0-9]+(\.[0-9]+)?$' then (l.payload_json->>'completionSeconds')::numeric end),0),
    ai.runs,ai.recommendations,ai.reviews,ai.helpful,o.total,o.done,o.support,o.no_issue,
    s.total,s.checked,s.resolved
  from active_students a cross join ai cross join observation o cross join signal_review s left join latest l on true
  group by a.count,ai.runs,ai.recommendations,ai.reviews,ai.helpful,o.total,o.done,o.support,o.no_issue,s.total,s.checked,s.resolved;
end;
$$;

revoke all on function public.teacher_get_pilot_metrics_auth(text) from public;
grant execute on function public.teacher_get_pilot_metrics_auth(text) to authenticated;
