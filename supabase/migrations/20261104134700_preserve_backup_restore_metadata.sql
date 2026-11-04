-- Restore application metadata without modifying existing class data during deployment.
begin;
set local lock_timeout='5s';
create or replace function public.class_backup_restore_before_coaching(p_class_id text,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  item jsonb; student_count integer:=0; response_count integer:=0; observation_count integer:=0;
  affected integer; same_class boolean:=p_backup->>'classId'=p_class_id;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  if p_backup->>'format' is distinct from 'class-ieum-backup-v1' then
    raise exception '지원하지 않는 백업 형식입니다.';
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_backup->'students','[]')) loop
    if item->>'student_number' is null or trim(coalesce(item->>'student_name',''))='' then continue; end if;
    insert into public.students(class_id,student_number,student_name,active,student_id,transferred_on)
    values(p_class_id,(item->>'student_number')::integer,item->>'student_name',coalesce((item->>'active')::boolean,true),
      case when same_class then coalesce((item->>'student_id')::uuid,gen_random_uuid()) else gen_random_uuid() end,
      (item->>'transferred_on')::date)
    on conflict(class_id,student_number) do update set student_name=excluded.student_name,active=excluded.active,
      transferred_on=case when item ? 'transferred_on' then excluded.transferred_on else students.transferred_on end;
    get diagnostics affected=row_count; student_count:=student_count+affected;
  end loop;

  insert into public.survey_responses(id,class_id,student_id,student_number,student_name,survey_month,submitted_at,payload_json,analysis_excluded,correction_note,deleted_at,deleted_by)
  select case when same_class then x.id else gen_random_uuid() end,p_class_id,s.student_id,x.student_number,x.student_name,x.survey_month,x.submitted_at,x.payload_json,
    coalesce(x.analysis_excluded,false),coalesce(x.correction_note,''),x.deleted_at,
    case when same_class and x.deleted_by=auth.uid() then x.deleted_by else null end
  from jsonb_to_recordset(coalesce(p_backup->'responses','[]'::jsonb))
    as x(id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb,analysis_excluded boolean,correction_note text,deleted_at timestamptz,deleted_by uuid)
  left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
  on conflict(id) do update set payload_json=excluded.payload_json,analysis_excluded=excluded.analysis_excluded,
    correction_note=excluded.correction_note,deleted_at=excluded.deleted_at,deleted_by=excluded.deleted_by
    where survey_responses.class_id=p_class_id and survey_responses.deleted_at is null;
  get diagnostics response_count=row_count;

  for item in select value from jsonb_array_elements(coalesce(p_backup->'observations','[]')) loop
    insert into public.observations(id,class_id,student_id,student_number,survey_month,title,planned_action,observed_fact,
      teacher_interpretation,interview_note,follow_up,follow_up_date,status,created_at,updated_at,
      outcome,source_type,source_snapshot,ai_run_id,signal_review_ids,deleted_at,deleted_by,deletion_reason)
    select case when same_class then x.id else gen_random_uuid() end,p_class_id,s.student_id,x.student_number,x.survey_month,x.title,
      coalesce(x.planned_action,''),coalesce(x.observed_fact,''),coalesce(x.teacher_interpretation,''),coalesce(x.interview_note,''),
      coalesce(x.follow_up,''),x.follow_up_date,coalesce(x.status,'todo'),coalesce(x.created_at,now()),coalesce(x.updated_at,now()),
      coalesce(x.outcome,'pending'),coalesce(x.source_type,'manual'),coalesce(nullif(x.source_snapshot,'null'::jsonb),'{}'::jsonb),
      case when same_class then (select a.id from public.ai_analysis_runs a where a.id=x.ai_run_id and a.class_id=p_class_id) else null end,
      case when same_class then array(select r.id from public.safety_signal_reviews r where r.id=any(x.signal_review_ids) and r.class_id=p_class_id order by r.id) else '{}'::uuid[] end,
      x.deleted_at,case when same_class and x.deleted_by=auth.uid() then x.deleted_by else null end,coalesce(x.deletion_reason,'')
    from jsonb_to_record(item) as x(id uuid,student_number integer,survey_month date,title text,planned_action text,observed_fact text,
      teacher_interpretation text,interview_note text,follow_up text,follow_up_date date,status text,created_at timestamptz,updated_at timestamptz,
      outcome text,source_type text,source_snapshot jsonb,ai_run_id uuid,signal_review_ids uuid[],deleted_at timestamptz,deleted_by uuid,deletion_reason text)
    left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
    on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,
      teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,
      follow_up_date=excluded.follow_up_date,status=excluded.status,updated_at=excluded.updated_at,
      created_at=case when item ? 'created_at' then excluded.created_at else observations.created_at end,
      outcome=case when item ? 'outcome' then excluded.outcome else observations.outcome end,
      source_type=case when item ? 'source_type' then excluded.source_type else observations.source_type end,
      source_snapshot=case when item ? 'source_snapshot' then excluded.source_snapshot else observations.source_snapshot end,
      ai_run_id=case when item ? 'ai_run_id' then excluded.ai_run_id else observations.ai_run_id end,
      signal_review_ids=case when item ? 'signal_review_ids' then excluded.signal_review_ids else observations.signal_review_ids end,
      deleted_at=excluded.deleted_at,deleted_by=excluded.deleted_by,deletion_reason=excluded.deletion_reason
      where observations.class_id=p_class_id and observations.deleted_at is null;
    get diagnostics affected=row_count; observation_count:=observation_count+affected;
  end loop;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'backup_restore','class',p_class_id,
    jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count,
      'source_class_id',p_backup->>'classId','cross_class',not same_class));
  return jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count,'crossClass',not same_class);
end;$$;
revoke all on function public.class_backup_restore_before_coaching(text,jsonb) from public,anon,authenticated;
commit;
