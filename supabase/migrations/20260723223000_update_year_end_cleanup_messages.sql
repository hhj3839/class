-- 화면의 보고서 생성·영구 삭제 2단계 흐름에 맞춰 사용자 오류 문구를 현행화합니다.
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
    raise exception '보고서를 만든 뒤 영구 삭제 준비를 다시 진행해 주세요.';
  end if;
  if cleanup.previewed_at<now()-interval '24 hours' then
    raise exception '영구 삭제 준비 시간이 지났습니다. 보고서를 다시 만들어 주세요.';
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
    raise exception '보고서 생성 이후 학급 자료가 변경되었습니다. 보고서를 다시 만들어 주세요.';
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

revoke all on function public.teacher_delete_year_end_data_auth(text,text,text,text) from public;
grant execute on function public.teacher_delete_year_end_data_auth(text,text,text,text) to authenticated;
