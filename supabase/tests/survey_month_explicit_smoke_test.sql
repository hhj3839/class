-- Synthetic-only production smoke test. Run with stop-on-error; all rows roll back.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $fixture$
declare
  test_class text := 'month-smoke-'||gen_random_uuid()::text;
  test_token uuid := gen_random_uuid();
  target_month date := (date_trunc('month',now() at time zone 'Asia/Seoul')-interval '1 month')::date;
  failed_column text;
begin
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='survey_responses' and column_name='survey_month' and column_default is not null) then
    raise exception 'MONTH_DEFAULT_REMAINS';
  end if;
  insert into public.classes(class_id,teacher_secret_hash,participation_token,survey_target_month)
    values(test_class,'synthetic-month-test-only',test_token,target_month);
  insert into public.students(class_id,student_number,student_name)
    values(test_class,1,'월검증가상학생');
  begin
    insert into public.survey_responses(class_id,student_number,student_name,payload_json)
      values(test_class,1,'월검증가상학생','{}'::jsonb);
    raise exception 'MISSING_MONTH_ACCEPTED';
  exception when not_null_violation then
    get stacked diagnostics failed_column=column_name;
    if failed_column <> 'survey_month' then raise; end if;
  end;
  perform set_config('app.month_test.class_id',test_class,true);
  perform set_config('app.month_test.token',test_token::text,true);
  perform set_config('app.month_test.month',to_char(target_month,'YYYY-MM'),true);
  perform set_config('request.jwt.claim.role','anon',true);
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
end
$fixture$;

set local role anon;
do $submit$
declare
  token uuid := current_setting('app.month_test.token')::uuid;
  target_month text := current_setting('app.month_test.month');
  payload jsonb := jsonb_build_object('submissionId',gen_random_uuid(),'surveyMonth',target_month,
    'submittedAt',now(),'studentState',jsonb_build_object('worryDetail','가상 월 검증'),'relationships','[]'::jsonb);
  first_id uuid;
begin
  if public.get_survey_month_by_token(token)->>'month' is distinct from target_month then
    raise exception 'TARGET_MONTH_NOT_RETURNED';
  end if;
  first_id := public.submit_response_by_token(token,1,'월검증가상학생',payload);
  if first_id is null or public.submit_response_by_token(token,1,'월검증가상학생',payload) is distinct from first_id then
    raise exception 'MONTH_SUBMISSION_RETRY_FAILED';
  end if;
end
$submit$;

reset role;
do $verify$
begin
  if (select count(*) from public.survey_responses where class_id=current_setting('app.month_test.class_id')) <> 1 then
    raise exception 'MONTH_RESPONSE_COUNT_MISMATCH';
  end if;
  if not exists(select 1 from public.survey_responses where class_id=current_setting('app.month_test.class_id')
    and to_char(survey_month,'YYYY-MM')=current_setting('app.month_test.month')
    and payload_json->>'surveyMonth'=current_setting('app.month_test.month')
    and to_char(submitted_at at time zone 'Asia/Seoul','YYYY-MM')<>current_setting('app.month_test.month')) then
    raise exception 'SELECTED_MONTH_OVERWRITTEN';
  end if;
end
$verify$;
rollback;
select 'PASS: omitted month rejected; anonymous past-month submission and retry preserved selected month; synthetic rows rolled back' as result;

