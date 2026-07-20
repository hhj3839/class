-- 우리반 이음: 학생 제출 중복 방지 운영 DB 스모크 테스트
-- 모든 변경은 마지막 ROLLBACK으로 취소되며 실제 응답은 남지 않습니다.

begin;

do $$
declare
  target_token uuid;
  target_number integer;
  target_name text;
  test_submission_id uuid:=gen_random_uuid();
  first_response_id uuid;
  retried_response_id uuid;
  stored_count integer;
  test_payload jsonb;
begin
  select c.participation_token,s.student_number,s.student_name
  into target_token,target_number,target_name
  from public.classes c
  join public.students s on s.class_id=c.class_id and s.active
  where c.participation_token is not null
  order by c.class_id,s.student_number
  limit 1;

  if target_token is null then
    raise exception '시험할 활성 학급과 학생을 찾을 수 없습니다.';
  end if;

  test_payload=jsonb_build_object(
    'action','idempotency_smoke_test',
    'submissionId',test_submission_id,
    'surveyMonth',to_char(current_date,'YYYY-MM'),
    'submittedAt',now(),
    'relationships','[]'::jsonb
  );

  first_response_id=public.submit_response_by_token(target_token,target_number,target_name,test_payload);
  retried_response_id=public.submit_response_by_token(target_token,target_number,target_name,test_payload);

  if first_response_id is distinct from retried_response_id then
    raise exception '실패: 재시도에서 서로 다른 응답 ID가 반환되었습니다.';
  end if;

  select count(*) into stored_count
  from public.survey_responses
  where submission_id=test_submission_id;

  if stored_count<>1 then
    raise exception '실패: 같은 제출 ID가 %건 저장되었습니다.',stored_count;
  end if;

  raise notice '통과: 같은 제출을 두 번 호출해도 응답 1건과 동일 ID만 유지되었습니다.';
end;
$$;

rollback;
