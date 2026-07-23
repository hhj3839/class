-- 학년 말 보고서 보관 확인 뒤 전년도 학급 자료를 안전하게 정리합니다.
create table if not exists public.year_end_cleanup_records (
  class_id text primary key references public.classes(class_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  school_year integer not null,
  report_generated_at timestamptz,
  report_file_name text not null default '',
  preview_fingerprint text not null default '',
  previewed_at timestamptz,
  deleted_at timestamptz,
  deletion_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.year_end_cleanup_records enable row level security;
revoke all on public.year_end_cleanup_records from anon, authenticated;

create or replace function public.year_end_cleanup_snapshot(p_class_id text)
returns jsonb
language sql
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'students', (select count(*) from public.students s where s.class_id=p_class_id),
    'responses', (select count(*) from public.survey_responses r where r.class_id=p_class_id),
    'observations', (select count(*) from public.observations o where o.class_id=p_class_id),
    'signalReviews', (select count(*) from public.safety_signal_reviews sr where sr.class_id=p_class_id),
    'aiAnalyses', (select count(*) from public.ai_analysis_runs a where a.class_id=p_class_id),
    'auditLogs', (select count(*) from public.audit_logs l where l.class_id=p_class_id),
    'latestResponseAt', (select max(r.submitted_at) from public.survey_responses r where r.class_id=p_class_id),
    'latestObservationAt', (select max(o.updated_at) from public.observations o where o.class_id=p_class_id),
    'latestAiAt', (select max(a.created_at) from public.ai_analysis_runs a where a.class_id=p_class_id)
  );
$$;

revoke all on function public.year_end_cleanup_snapshot(text) from public;

create or replace function public.teacher_mark_year_end_report_auth(
  p_class_id text,
  p_file_name text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_year integer;
begin
  select c.school_year into target_year
  from public.classes c
  where c.class_id=p_class_id and c.teacher_id=auth.uid();
  if target_year is null then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if target_year>=extract(year from current_date)::integer then
    raise exception '현재 학년도 자료는 학년 말 정리 대상으로 선택할 수 없습니다.';
  end if;
  if trim(coalesce(p_file_name,''))='' then raise exception '보고서 파일 이름이 필요합니다.'; end if;

  insert into public.year_end_cleanup_records(
    class_id,teacher_id,school_year,report_generated_at,report_file_name,
    preview_fingerprint,previewed_at,deleted_at,deletion_counts,updated_at
  ) values(
    p_class_id,auth.uid(),target_year,now(),trim(p_file_name),'',null,null,'{}'::jsonb,now()
  )
  on conflict(class_id) do update set
    teacher_id=auth.uid(),school_year=excluded.school_year,
    report_generated_at=now(),report_file_name=excluded.report_file_name,
    preview_fingerprint='',previewed_at=null,deleted_at=null,
    deletion_counts='{}'::jsonb,updated_at=now();

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'year_end_report_generated','class',p_class_id,
    jsonb_build_object('school_year',target_year,'file_name',trim(p_file_name)));

  return jsonb_build_object('schoolYear',target_year,'reportGeneratedAt',now(),'fileName',trim(p_file_name));
end;
$$;

create or replace function public.teacher_preview_year_end_cleanup_auth(p_class_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_class public.classes%rowtype;
  report_at timestamptz;
  counts jsonb;
  fingerprint text;
begin
  select * into target_class
  from public.classes c
  where c.class_id=p_class_id and c.teacher_id=auth.uid();
  if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if target_class.school_year>=extract(year from current_date)::integer then
    raise exception '현재 학년도 자료는 학년 말 정리 대상으로 선택할 수 없습니다.';
  end if;

  select r.report_generated_at into report_at
  from public.year_end_cleanup_records r
  where r.class_id=p_class_id and r.teacher_id=auth.uid() and r.deleted_at is null;
  if report_at is null then raise exception '학년 말 보고서를 먼저 생성하고 보관 상태를 확인해 주세요.'; end if;

  counts:=public.year_end_cleanup_snapshot(p_class_id);
  fingerprint:=encode(extensions.digest(
    p_class_id||':'||target_class.school_year::text||':'||counts::text||':'||report_at::text,
    'sha256'
  ),'hex');

  update public.year_end_cleanup_records
  set preview_fingerprint=fingerprint,previewed_at=now(),updated_at=now()
  where class_id=p_class_id and teacher_id=auth.uid();

  return jsonb_build_object(
    'classId',p_class_id,
    'schoolYear',target_class.school_year,
    'classLabel',target_class.grade||'학년 '||target_class.class_number||'반',
    'reportGeneratedAt',report_at,
    'counts',counts,
    'fingerprint',fingerprint,
    'previewedAt',now()
  );
end;
$$;

create or replace function public.teacher_delete_year_end_data_auth(
  p_class_id text,
  p_fingerprint text,
  p_class_label text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_class public.classes%rowtype;
  cleanup public.year_end_cleanup_records%rowtype;
  counts jsonb;
  expected_fingerprint text;
  expected_label text;
begin
  select * into target_class
  from public.classes c
  where c.class_id=p_class_id and c.teacher_id=auth.uid()
  for update;
  if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if target_class.school_year>=extract(year from current_date)::integer then
    raise exception '현재 학년도 자료는 삭제할 수 없습니다.';
  end if;

  select * into cleanup
  from public.year_end_cleanup_records r
  where r.class_id=p_class_id and r.teacher_id=auth.uid()
  for update;
  if not found or cleanup.report_generated_at is null or cleanup.previewed_at is null then
    raise exception '보고서 생성과 삭제 대상 미리보기를 먼저 완료해 주세요.';
  end if;
  if cleanup.previewed_at<now()-interval '24 hours' then
    raise exception '삭제 대상 미리보기 유효 시간이 지났습니다. 다시 확인해 주세요.';
  end if;

  expected_label:=target_class.grade||'학년 '||target_class.class_number||'반';
  if trim(coalesce(p_class_label,''))<>expected_label then raise exception '학급 이름이 일치하지 않습니다.'; end if;
  if trim(coalesce(p_confirmation,''))<>'전년도 학급 자료 삭제' then raise exception '최종 확인 문구가 일치하지 않습니다.'; end if;

  counts:=public.year_end_cleanup_snapshot(p_class_id);
  expected_fingerprint:=encode(extensions.digest(
    p_class_id||':'||target_class.school_year::text||':'||counts::text||':'||cleanup.report_generated_at::text,
    'sha256'
  ),'hex');
  if coalesce(p_fingerprint,'')<>expected_fingerprint
    or cleanup.preview_fingerprint<>expected_fingerprint then
    raise exception '미리보기 이후 학급 자료가 변경되었습니다. 삭제 대상을 다시 확인해 주세요.';
  end if;

  delete from public.safety_signal_reviews where class_id=p_class_id;
  delete from public.observations where class_id=p_class_id;
  delete from public.ai_analysis_runs where class_id=p_class_id;
  delete from public.survey_responses where class_id=p_class_id;
  delete from public.students where class_id=p_class_id;
  delete from public.data_retention_policies where class_id=p_class_id;
  delete from public.audit_logs where class_id=p_class_id;

  update public.classes
  set participation_token=gen_random_uuid()
  where class_id=p_class_id and teacher_id=auth.uid();

  update public.year_end_cleanup_records
  set deleted_at=now(),deletion_counts=counts,updated_at=now()
  where class_id=p_class_id and teacher_id=auth.uid();

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'year_end_data_deleted','class',p_class_id,
    jsonb_build_object(
      'school_year',target_class.school_year,
      'report_generated_at',cleanup.report_generated_at,
      'deleted_counts',counts
    ));

  return jsonb_build_object(
    'deletedAt',now(),
    'schoolYear',target_class.school_year,
    'classLabel',expected_label,
    'counts',counts
  );
end;
$$;

revoke all on function public.teacher_mark_year_end_report_auth(text,text) from public;
revoke all on function public.teacher_preview_year_end_cleanup_auth(text) from public;
revoke all on function public.teacher_delete_year_end_data_auth(text,text,text,text) from public;

grant execute on function public.teacher_mark_year_end_report_auth(text,text) to authenticated;
grant execute on function public.teacher_preview_year_end_cleanup_auth(text) to authenticated;
grant execute on function public.teacher_delete_year_end_data_auth(text,text,text,text) to authenticated;
