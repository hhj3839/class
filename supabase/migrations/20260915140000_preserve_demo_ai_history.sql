-- 기능 점검용 demo-* 학급의 최근 12개월 자료를 로그인 시점에 현재 달까지 이동합니다.
-- 담당 교사가 소유한 데모 학급만 앞으로 이동하며 운영 학급은 변경하지 않습니다.
create or replace function public.teacher_roll_demo_months_forward_auth(p_class_id text)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  latest_month date;
  target_month date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
  months_to_shift integer;
  shift_interval interval;
begin
  if p_class_id not like 'demo-%' then
    raise exception '기능 점검용 데모 학급만 자동 최신화할 수 있습니다.';
  end if;
  perform 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid() for update;
  if not found then raise exception '담당 데모 학급에 대한 권한이 없습니다.'; end if;

  select max(r.survey_month) into latest_month
  from public.survey_responses r
  where r.class_id=p_class_id and r.deleted_at is null;

  if latest_month is null then return 0; end if;
  months_to_shift:=
    (extract(year from target_month)::integer*12+extract(month from target_month)::integer)
    -(extract(year from latest_month)::integer*12+extract(month from latest_month)::integer);
  if months_to_shift<=0 then return 0; end if;
  shift_interval:=make_interval(months=>months_to_shift);

  update public.survey_responses
  set survey_month=(survey_month+shift_interval)::date,
      submitted_at=submitted_at+shift_interval,
      client_submitted_at=case when client_submitted_at is null then null else client_submitted_at+shift_interval end,
      payload_json=jsonb_set(payload_json,'{surveyMonth}',to_jsonb(to_char((survey_month+shift_interval)::date,'YYYY-MM')),true)
  where class_id=p_class_id;

  -- AI history and its evidence month stay unchanged; no automatic regeneration.

  update public.observations
  set survey_month=case when survey_month is null then null else (survey_month+shift_interval)::date end,
      follow_up_date=case when follow_up_date is null then null else (follow_up_date+shift_interval)::date end,
      updated_at=updated_at+shift_interval
  where class_id=p_class_id;

  update public.safety_signal_reviews
  set follow_up_date=case when follow_up_date is null then null else (follow_up_date+shift_interval)::date end,
      updated_at=updated_at+shift_interval
  where class_id=p_class_id;

  update public.classes
  set school_year=extract(year from target_month)::integer
  where class_id=p_class_id and teacher_id=auth.uid();

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'demo_months_rolled_forward','class',p_class_id,
    jsonb_build_object('months_shifted',months_to_shift,'latest_month',target_month,'ai_history_preserved',true));
  return months_to_shift;
end;
$$;

revoke all on function public.teacher_roll_demo_months_forward_auth(text) from public;
grant execute on function public.teacher_roll_demo_months_forward_auth(text) to authenticated;
