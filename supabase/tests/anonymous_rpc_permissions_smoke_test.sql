-- Production-safe permission smoke test: synthetic rows only, always ROLLBACK.
-- Run as the migration administrator. Assertions fail on unexpected success/error codes.
-- No real class, student, response, teacher account or AI call is used.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $fixture$
declare
  test_class text := 'permission-smoke-'||gen_random_uuid()::text;
  test_token uuid := gen_random_uuid();
  test_month date := date_trunc('month',now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.classes(class_id,teacher_secret_hash,participation_token,survey_target_month)
    values(test_class,'synthetic-permission-test-only',test_token,test_month);
  insert into public.students(class_id,student_number,student_name)
    values(test_class,1,'권한시험가상학생'),(test_class,2,'권한시험가상친구');
  perform set_config('app.permission_test.class_id',test_class,true);
  perform set_config('app.permission_test.token',test_token::text,true);
  perform set_config('app.permission_test.month',to_char(test_month,'YYYY-MM'),true);
  perform set_config('app.permission_test.submission_id',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claim.role','anon',true);
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
end
$fixture$;

set local role anon;
do $student$
declare
  test_token uuid := current_setting('app.permission_test.token')::uuid;
  test_month text := current_setting('app.permission_test.month');
  payload jsonb := jsonb_build_object(
    'submissionId',current_setting('app.permission_test.submission_id'),
    'surveyMonth',test_month,'worryDetail','권한 검증용 가상 응답','relationships','[]'::jsonb
  );
  first_id uuid;
  retry_id uuid;
begin
  if current_user <> 'anon' then raise exception 'SMOKE_NOT_ANON'; end if;
  if (select count(*) from public.get_roster_by_token(test_token)) <> 2 then
    raise exception 'SMOKE_ROSTER_FAILED';
  end if;
  if public.get_survey_month_by_token(test_token)->>'month' is distinct from test_month then
    raise exception 'SMOKE_MONTH_FAILED';
  end if;
  first_id := public.submit_response_by_token(test_token,1,'권한시험가상학생',payload);
  retry_id := public.submit_response_by_token(test_token,1,'권한시험가상학생',payload);
  if first_id is null or retry_id is distinct from first_id then
    raise exception 'SMOKE_IDEMPOTENCY_FAILED';
  end if;

  begin
    perform public.submit_response_by_token(test_token,1,'틀린이름',payload);
    raise exception 'SMOKE_WRONG_STUDENT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> '참여 링크 또는 학생 정보를 확인할 수 없습니다.' then raise; end if;
  end;
  begin
    perform public.get_survey_month_by_token(gen_random_uuid());
    raise exception 'SMOKE_INVALID_TOKEN_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> '참여 링크를 확인해 주세요.' then raise; end if;
  end;
  begin
    perform public.submit_response_by_token(test_token,1,'권한시험가상학생',
      payload||jsonb_build_object('submissionId',gen_random_uuid(),'surveyMonth','2000-01'));
    raise exception 'SMOKE_WRONG_MONTH_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> '선생님이 설문 대상 월을 변경했습니다. 작성 내용은 이 탭에 남아 있습니다. 선생님께 확인한 뒤 새로고침해 주세요.' then raise; end if;
  end;

  begin
    perform public.teacher_get_my_classes();
    raise exception 'SMOKE_TEACHER_RPC_EXPOSED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.teacher_get_responses('permission-smoke-missing','invalid-secret');
    raise exception 'SMOKE_LEGACY_RPC_EXPOSED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.teacher_get_student_review_cycles_auth('permission-smoke-missing');
    raise exception 'SMOKE_RETIRED_RPC_EXPOSED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.guest_lab_quota(null);
    raise exception 'SMOKE_SERVICE_RPC_EXPOSED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.survey_responses limit 1;
    raise exception 'SMOKE_RAW_RESPONSES_EXPOSED';
  exception when insufficient_privilege then null;
  end;
end
$student$;

reset role;
do $verify$
begin
  if (select count(*) from public.survey_responses
      where class_id=current_setting('app.permission_test.class_id')) <> 1 then
    raise exception 'SMOKE_DUPLICATE_RESPONSE';
  end if;
  if not exists(select 1 from public.survey_responses r join public.students s on s.student_id=r.student_id
      where r.class_id=current_setting('app.permission_test.class_id')
        and r.submission_id=current_setting('app.permission_test.submission_id')::uuid
        and s.student_number=1
        and r.payload_json->>'worryDetail'='권한 검증용 가상 응답') then
    raise exception 'SMOKE_SAVED_RESPONSE_MISMATCH';
  end if;
end
$verify$;

rollback;
select 'PASS: anonymous survey, retry, invalid inputs, teacher/legacy/service/table denial; synthetic rows rolled back' as result;

