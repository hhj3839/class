-- 가상 학급만 생성하며 성공·실패 여부와 무관하게 운영 자료를 삭제하지 않습니다.
begin;
set local lock_timeout='5s';
do $$
declare owner_id uuid; source_class text:='coaching-backup-check-'||gen_random_uuid(); target_class text:=source_class||'-restore';
  student_key uuid:=gen_random_uuid(); card_key uuid:=gen_random_uuid(); pending_key uuid:=gen_random_uuid(); restored_student uuid;
  backup jsonb; result jsonb; snapshot jsonb; preview jsonb; denied boolean; original_hash text;
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then raise exception '테스트 교사 계정이 없습니다.'; end if;
  insert into public.classes(class_id,teacher_id,teacher_secret_hash,teacher_name,school_year,grade,class_number)
    values(source_class,owner_id,'unused','가상 교사',2020,3,1),(target_class,owner_id,'unused','가상 교사',2020,3,2);
  insert into public.students(class_id,student_id,student_number,student_name) values(source_class,student_key,1,'가상 학생');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  original_hash:=public.teacher_get_student_coaching_context_auth(source_class,student_key)->>'sourceHash';
  insert into public.student_coaching_cards(id,class_id,student_id,teacher_id,source_hash,basis_month,status,result_json)
    values(card_key,source_class,student_key,owner_id,original_hash,'2020-06','complete','{"summary":"가상 코칭"}'),
      (pending_key,source_class,student_key,owner_id,original_hash,'2020-06','pending','{}');
  perform public.teacher_record_student_coaching_feedback_auth(source_class,card_key,'helpful','가상 적용 결과');
  backup:=public.teacher_export_class_backup_auth(source_class);
  result:=public.teacher_restore_class_backup_auth(source_class,backup-'coachingCards'-'coachingFeedback'-'coachingBackupVersion');
  if (result->>'coachingCards')::integer<>0 then raise exception '이전 백업 호환성 실패'; end if;
  if jsonb_array_length(backup->'coachingCards')<>2 or jsonb_array_length(backup->'coachingFeedback')<>1 then raise exception '코칭 백업 누락'; end if;
  result:=public.teacher_restore_class_backup_auth(source_class,backup);
  if (result->>'coachingCards')::integer<>0 or (result->>'coachingFeedback')::integer<>0 then raise exception '같은 학급 중복 복구'; end if;
  if (select source_hash from public.student_coaching_cards where id=card_key)<>original_hash then raise exception '기존 카드 변조'; end if;
  result:=public.teacher_restore_class_backup_auth(target_class,backup);
  if (result->>'coachingCards')::integer<>2 or (result->>'coachingFeedback')::integer<>1 then raise exception '다른 학급 코칭 복구 실패'; end if;
  select student_id into restored_student from public.students where class_id=target_class;
  if restored_student=student_key then raise exception '학생 식별자 분리 실패'; end if;
  if exists(select 1 from public.student_coaching_cards where class_id=target_class and (student_id<>restored_student or source_hash not like 'restored:%' or status='pending')) then raise exception '복구 카드 격리 실패'; end if;
  snapshot:=public.year_end_cleanup_snapshot(target_class);
  if (snapshot->>'coachingCards')::integer<>2 or (snapshot->>'coachingFeedback')::integer<>1 then raise exception '정리 대상 집계 실패'; end if;
  update public.student_coaching_feedback set note='가상 변경' where card_id in(select id from public.student_coaching_cards where class_id=target_class);
  if snapshot->>'coachingFingerprint'=public.year_end_cleanup_snapshot(target_class)->>'coachingFingerprint' then raise exception '적용 결과 변경 미감지'; end if;
  perform public.teacher_delete_student_coaching_auth(source_class,card_key);
  perform public.teacher_restore_class_backup_auth(source_class,backup);
  if exists(select 1 from public.student_coaching_cards where id=card_key and (deleted_at is null or result_json<>'{}')) or exists(select 1 from public.student_coaching_feedback where card_id=card_key) then raise exception '삭제한 카드 부활'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied:=false; begin perform public.teacher_export_class_backup_auth(source_class); exception when others then denied:=true; end;
  if not denied then raise exception '다른 교사 백업 차단 실패'; end if;
  denied:=false; begin perform public.teacher_restore_class_backup_auth(target_class,backup); exception when others then denied:=true; end;
  if not denied then raise exception '다른 교사 복구 차단 실패'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.teacher_mark_year_end_report_auth(target_class,'가상보고서.pdf');
  preview:=public.teacher_preview_year_end_cleanup_auth(target_class);
  update public.student_coaching_feedback set note='미리보기 후 변경' where card_id in(select id from public.student_coaching_cards where class_id=target_class);
  denied:=false; begin perform public.teacher_delete_year_end_data_auth(target_class,preview->>'fingerprint','3학년 2반','전년도 학급 자료 삭제'); exception when others then denied:=true; end;
  if not denied then raise exception '변경 후 삭제 차단 실패'; end if;
  perform public.teacher_mark_year_end_report_auth(target_class,'가상보고서.pdf');
  preview:=public.teacher_preview_year_end_cleanup_auth(target_class);
  perform public.teacher_delete_year_end_data_auth(target_class,preview->>'fingerprint','3학년 2반','전년도 학급 자료 삭제');
  if exists(select 1 from public.student_coaching_cards where class_id=target_class) then raise exception '가상 학급 코칭 정리 실패'; end if;
  if not exists(select 1 from public.student_coaching_cards where class_id=source_class) then raise exception '원본 학급 보존 실패'; end if;
  if has_function_privilege('authenticated','public.class_backup_restore_before_coaching(text,jsonb)','execute') or has_function_privilege('anon','public.teacher_export_class_backup_auth(text)','execute') then raise exception '함수 권한 오류'; end if;
end $$;
rollback;
