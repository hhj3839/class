-- 마이그레이션 적용 후 검증. 가상 레코드만 만들고 반드시 ROLLBACK합니다.
begin;
set local lock_timeout='5s';
do $$
declare teacher uuid; fixture_class text:='transfer-check-'||gen_random_uuid(); fixture_student uuid:=gen_random_uuid(); fixture_token uuid:=gen_random_uuid(); result jsonb; denied boolean:=false; count_before integer;
begin
  select id into teacher from auth.users limit 1;
  if teacher is null then raise exception '테스트에 사용할 기존 교사 계정이 없습니다.'; end if;
  insert into public.classes(class_id,teacher_secret_hash,teacher_id,teacher_name,participation_token)
    values(fixture_class,'unused-test-hash',teacher,'가상 교사',fixture_token);
  insert into public.students(class_id,student_id,student_number,student_name) values(fixture_class,fixture_student,1,'가상 학생');
  insert into public.survey_responses(class_id,student_id,student_number,student_name,survey_month,payload_json)
    values(fixture_class,fixture_student,1,'가상 학생','2026-08-01','{}');
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  perform public.teacher_set_student_transfer_auth(fixture_class,fixture_student,(now() at time zone 'Asia/Seoul')::date);
  if exists(select 1 from public.students where student_id=fixture_student and active) then raise exception '전출 상태 실패'; end if;
  if exists(select 1 from public.get_roster_by_token(fixture_token)) then raise exception '학생 설문 명단 제외 실패'; end if;
  result:=public.teacher_get_class_context_auth(fixture_class);
  if jsonb_array_length(result->'students')<>1 or result#>>'{students,0,transferredOn}' is null then raise exception '과거 명단 보존 실패'; end if;
  perform public.teacher_sync_roster_auth(fixture_class,jsonb_build_array(jsonb_build_object('studentId',fixture_student,'number',1,'name','가상 학생')));
  if exists(select 1 from public.students where student_id=fixture_student and active) then raise exception '명단 동기화가 전출을 취소함'; end if;
  begin
    perform public.submit_response_by_token(fixture_token,1,'가상 학생',jsonb_build_object('surveyMonth','2026-09','submissionId',gen_random_uuid()));
  exception when others then denied:=true; end;
  if not denied then raise exception '전출 학생 제출 차단 실패'; end if;
  denied:=false;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.teacher_set_student_transfer_auth(fixture_class,fixture_student,null); exception when others then denied:=true; end;
  if not denied then raise exception '다른 교사 접근 차단 실패'; end if;
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  denied:=false;
  begin perform public.teacher_set_student_transfer_auth(fixture_class,fixture_student,(now() at time zone 'Asia/Seoul')::date+1); exception when others then denied:=true; end;
  if not denied then raise exception '미래 날짜 차단 실패'; end if;
  perform public.teacher_set_student_transfer_auth(fixture_class,fixture_student,null);
  if not exists(select 1 from public.get_roster_by_token(fixture_token)) then raise exception '전출 취소 실패'; end if;
  if (select count(*) from public.survey_responses where class_id=fixture_class)<>1 then raise exception '과거 응답 보존 실패'; end if;
  if (select count(*) from public.audit_logs where class_id=fixture_class and action in('student_transfer','student_transfer_cancel'))<>2 then raise exception '감사 기록 실패'; end if;
  if has_function_privilege('anon','public.teacher_set_student_transfer_auth(text,uuid,date)','execute') then raise exception '익명 실행 권한 오류'; end if;
end;$$;
rollback;
