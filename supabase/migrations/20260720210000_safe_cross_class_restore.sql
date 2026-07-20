-- 백업을 별도 시험 학급에 복구할 때 운영 학급의 UUID와 충돌하지 않도록 재발급합니다.
create or replace function public.teacher_restore_class_backup_auth(p_class_id text,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  student_count integer:=0;
  response_count integer:=0;
  observation_count integer:=0;
  source_class_id text:=coalesce(p_backup->>'classId','');
  same_class boolean:=source_class_id=p_class_id;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  if p_backup->>'format'<>'class-ieum-backup-v1' then
    raise exception '지원하지 않는 백업 형식입니다.';
  end if;

  insert into public.students(class_id,student_number,student_name,active,student_id)
  select p_class_id,x.student_number,x.student_name,coalesce(x.active,true),
    case when same_class then coalesce(x.student_id,gen_random_uuid()) else gen_random_uuid() end
  from jsonb_to_recordset(coalesce(p_backup->'students','[]'::jsonb))
    as x(student_id uuid,student_number integer,student_name text,active boolean)
  where x.student_number is not null and trim(coalesce(x.student_name,''))<>''
  on conflict(class_id,student_number) do update
    set student_name=excluded.student_name,active=excluded.active;
  get diagnostics student_count=row_count;

  insert into public.survey_responses(id,class_id,student_id,student_number,student_name,survey_month,submitted_at,payload_json,analysis_excluded,correction_note,deleted_at,deleted_by)
  select case when same_class then x.id else gen_random_uuid() end,p_class_id,s.student_id,x.student_number,x.student_name,x.survey_month,x.submitted_at,x.payload_json,
    coalesce(x.analysis_excluded,false),coalesce(x.correction_note,''),x.deleted_at,null
  from jsonb_to_recordset(coalesce(p_backup->'responses','[]'::jsonb))
    as x(id uuid,student_id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb,analysis_excluded boolean,correction_note text,deleted_at timestamptz)
  left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
  on conflict(id) do update set payload_json=excluded.payload_json,analysis_excluded=excluded.analysis_excluded,
    correction_note=excluded.correction_note,deleted_at=excluded.deleted_at
    where survey_responses.class_id=p_class_id;
  get diagnostics response_count=row_count;

  insert into public.observations(id,class_id,student_id,student_number,survey_month,title,planned_action,observed_fact,teacher_interpretation,interview_note,follow_up,follow_up_date,status,updated_at)
  select case when same_class then x.id else gen_random_uuid() end,p_class_id,s.student_id,x.student_number,x.survey_month,x.title,
    coalesce(x.planned_action,''),coalesce(x.observed_fact,''),coalesce(x.teacher_interpretation,''),coalesce(x.interview_note,''),
    coalesce(x.follow_up,''),x.follow_up_date,coalesce(x.status,'todo'),coalesce(x.updated_at,now())
  from jsonb_to_recordset(coalesce(p_backup->'observations','[]'::jsonb))
    as x(id uuid,student_id uuid,student_number integer,survey_month date,title text,planned_action text,observed_fact text,teacher_interpretation text,interview_note text,follow_up text,follow_up_date date,status text,updated_at timestamptz)
  left join public.students s on s.class_id=p_class_id and s.student_number=x.student_number
  on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,
    teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,
    follow_up_date=excluded.follow_up_date,status=excluded.status,updated_at=excluded.updated_at
    where observations.class_id=p_class_id;
  get diagnostics observation_count=row_count;

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'backup_restore','class',p_class_id,
    jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count,'source_class_id',source_class_id,'cross_class',not same_class));
  return jsonb_build_object('students',student_count,'responses',response_count,'observations',observation_count,'crossClass',not same_class);
end;$$;

revoke all on function public.teacher_restore_class_backup_auth(text,jsonb) from public;
grant execute on function public.teacher_restore_class_backup_auth(text,jsonb) to authenticated;
