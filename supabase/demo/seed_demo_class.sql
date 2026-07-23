-- 우리반 이음 기능 점검용 비식별 데모 학급
-- 1) 아래 이메일만 실제 시험용 교사 계정으로 바꿉니다.
-- 2) Supabase SQL Editor에서 전체 실행합니다.
-- 같은 계정에 다시 실행하면 데모 학급만 초기화해 동일한 기준 자료를 만듭니다.
do $$
declare
  target_email constant text := 'REPLACE_WITH_TEST_TEACHER_EMAIL';
  target_teacher uuid;
  demo_class text;
  demo_month date := date_trunc('month', current_date)::date;
  response_id uuid;
  student_id_value uuid;
  payload jsonb;
  relationships jsonb;
  student_names text[] := array['김하늘','이하람','박이음','최다온','정라온','윤새봄','한누리','오가람','서마루','임보라'];
  month_offset integer;
  student_number integer;
  target_number integer;
  score integer;
begin
  if target_email = concat('REPLACE_WITH_TEST','_TEACHER_EMAIL') then
    raise exception 'target_email을 실제 시험용 교사 이메일로 바꿔 주세요.';
  end if;

  select id into target_teacher
  from auth.users
  where lower(email) = lower(target_email)
  order by created_at
  limit 1;

  if target_teacher is null then
    raise exception '시험용 교사 계정을 찾을 수 없습니다: %', target_email;
  end if;

  demo_class := 'demo-' || substr(replace(target_teacher::text, '-', ''), 1, 16);

  -- 이 교사에게 속한 고정 demo-* 학급만 교체한다. 운영 학급은 건드리지 않는다.
  delete from public.classes
  where class_id = demo_class
    and teacher_id = target_teacher
    and class_id like 'demo-%';

  insert into public.classes(
    class_id, teacher_secret_hash, teacher_id, teacher_name,
    school_year, grade, class_number, participation_token
  ) values (
    demo_class, encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    target_teacher, '기능 점검 교사', extract(year from current_date)::integer,
    5, 99, gen_random_uuid()
  );

  for student_number in 1..10 loop
    student_id_value := md5(target_teacher::text || ':demo-student:' || student_number)::uuid;
    insert into public.students(class_id, student_number, student_name, active, student_id)
    values(demo_class, student_number, student_names[student_number], true, student_id_value);
  end loop;

  -- 지난 3개월 자료. 최신 달에는 6번 학생을 미제출로 남겨 빈 응답+지원 기록을 확인한다.
  for month_offset in reverse 2..0 loop
    for student_number in 1..10 loop
      if (month_offset = 2 and student_number > 8) or (month_offset = 0 and student_number = 6) then
        continue;
      end if;

      relationships := '[]'::jsonb;
      for target_number in 1..10 loop
        if target_number <> student_number then
          -- 세 개의 느슨한 관계 묶음, 묶음 사이 연결, 비대칭, 월별 강화·약화를 함께 만든다.
          score := case
            -- 1↔3은 최근으로 올수록 3→4→5점으로 강화된다.
            when (student_number,target_number) in ((1,3),(3,1)) then 5-month_offset
            -- 2↔7은 최근으로 올수록 4→3→2점으로 약화된다.
            when (student_number,target_number) in ((2,7),(7,2)) then 2+month_offset
            -- A(1·3·9), B(2·5·7), C(4·6·8) 안의 나머지 편안한 상호 관계
            when student_number in (1,3,9) and target_number in (1,3,9) then 5
            when student_number in (2,5,7) and target_number in (2,5,7) then 5
            when student_number in (4,6,8) and target_number in (4,6,8) then 5
            -- 묶음 사이에서 연결 역할을 하는 상호 4점 관계
            when (student_number,target_number) in ((3,5),(5,3),(7,8),(8,7)) then 4
            -- 같은 관계를 다르게 경험하는 두 방향의 비대칭 사례
            when (student_number,target_number) in ((1,2),(5,4)) then 5
            when (student_number,target_number) in ((2,1),(4,5)) then 2
            -- 4번은 친구에 따라 받은 점수 차이가 크게 보이도록 구성한다.
            when target_number=4 and student_number in (1,3,9) then 1
            when target_number=4 and student_number in (2,7) then 2
            -- 10번은 8번과만 상호 4점이며 여러 방향 연결이 아직 확인되지 않는다.
            when (student_number,target_number) in ((8,10),(10,8)) then 4
            else 2 + ((student_number + target_number + month_offset) % 2)
          end;
          relationships := relationships || jsonb_build_array(jsonb_build_object('targetNumber', target_number, 'score', score));
        end if;
      end loop;

      response_id := md5(target_teacher::text || ':demo-response:' || month_offset || ':' || student_number)::uuid;
      payload := jsonb_build_object(
        'studentNumber', student_number,
        'studentName', student_names[student_number],
        'surveyMonth', to_char(demo_month - make_interval(months => month_offset), 'YYYY-MM'),
        'helpNow', case
          when month_offset = 0 and student_number = 4 then '바로 도와주세요.'
          when month_offset = 0 and student_number = 5 then '이번 주에 이야기하고 싶어요.'
          else '지금은 괜찮아요.' end,
        'selfRatings', jsonb_build_object(
          'study', jsonb_build_object('score', greatest(1, least(5, 3 + ((student_number + month_offset) % 3) - 1))),
          'listening', jsonb_build_object('score', greatest(1, least(5, 4 - (student_number % 2)))),
          'respect', jsonb_build_object('score', case when student_number = 2 then greatest(2, 5 - month_offset) else 4 end),
          'manners', jsonb_build_object('score', 4),
          'responsibility', jsonb_build_object('score', case when student_number = 4 and month_offset = 0 then 2 else 4 end)
        ),
        'studentState', jsonb_build_object(
          'worryDetail', case
            when month_offset = 0 and student_number = 4 then '모둠 활동에서 제 이야기가 자주 넘어가는 것 같아 속상했어요.'
            when month_offset = 0 and student_number = 5 then '이번 주에 선생님과 조용히 이야기하고 싶어요.'
            when student_number = 2 then '쉬는 시간에 누구와 함께할지 가끔 고민돼요.'
            else '특별히 마음에 걸리는 일은 없어요.' end,
          'teacherWish', case when student_number in (4,5) and month_offset = 0 then '제 이야기를 먼저 들어 주세요.' else '지금처럼 지켜봐 주세요.' end
        ),
        'peerObservations', jsonb_build_object(
          'kind', jsonb_build_object('studentNumbers', case when student_number <> 1 then jsonb_build_array(1) else jsonb_build_array(9) end, 'detail', case when student_number <> 1 then '김하늘이 준비물을 함께 챙겨 주었어요.' else '서마루가 차례를 잘 기다려 주었어요.' end),
          'growth', jsonb_build_object('studentNumbers', case when student_number <> 3 then jsonb_build_array(3) else jsonb_build_array(9) end, 'detail', case when student_number <> 3 then '박이음이 발표할 때 자신감이 생겼어요.' else '서마루가 친구 말을 더 잘 들어 주었어요.' end),
          'hurt', jsonb_build_object('studentNumbers', '[]'::jsonb, 'detail', ''),
          'needsHelp', jsonb_build_object('studentNumbers', case when month_offset = 0 and student_number in (2,3) then jsonb_build_array(4) else '[]'::jsonb end, 'detail', case when month_offset = 0 and student_number in (2,3) then '최다온이 모둠 활동에서 말할 기회가 필요해 보여요.' else '' end)
        ),
        'unresolved', jsonb_build_object('detail', case when month_offset = 0 and student_number = 4 then '친구에게 아직 말하지 못했어요.' else '' end),
        'relationships', relationships
      );

      insert into public.survey_responses(
        id, class_id, student_id, student_number, student_name, survey_month,
        submitted_at, client_submitted_at, payload_json, analysis_excluded,
        correction_note, submission_id
      ) values (
        response_id, demo_class,
        md5(target_teacher::text || ':demo-student:' || student_number)::uuid,
        student_number, student_names[student_number], demo_month - make_interval(months => month_offset),
        demo_month - make_interval(months => month_offset) + interval '9 hours' + make_interval(mins => student_number),
        demo_month - make_interval(months => month_offset) + interval '9 hours' + make_interval(mins => student_number),
        payload, false, '', md5(target_teacher::text || ':demo-submission:' || month_offset || ':' || student_number)::uuid
      );
    end loop;
  end loop;

  -- 추가 제출과 분석 제외 사례
  insert into public.survey_responses(
    id, class_id, student_id, student_number, student_name, survey_month,
    submitted_at, payload_json, analysis_excluded, correction_note, submission_id
  )
  select md5(target_teacher::text || ':demo-extra:8')::uuid, demo_class, r.student_id, 8, r.student_name,
    demo_month, demo_month + interval '11 hours',
    jsonb_set(r.payload_json, '{studentState,worryDetail}', '"제출 내용을 다시 확인해 수정했어요."'::jsonb),
    false, '', md5(target_teacher::text || ':demo-extra-submission:8')::uuid
  from public.survey_responses r where r.class_id=demo_class and r.student_number=8 and r.survey_month=demo_month limit 1;

  update public.survey_responses r set analysis_excluded=true, correction_note='데모: 분석 제외 상태 확인'
  where r.class_id=demo_class and r.student_number=7 and r.survey_month=demo_month - interval '1 month';

  -- 확인이 필요한 응답 상태 3종
  insert into public.safety_signal_reviews(
    id,class_id,signal_key,student_id,student_number,source_response_id,signal_type,status,
    note,follow_up_date,source_snapshot,updated_by,updated_at
  ) values
  (md5(target_teacher::text||':demo-signal:4')::uuid,demo_class,'demo-urgent-4',md5(target_teacher::text||':demo-student:4')::uuid,4,md5(target_teacher::text||':demo-response:0:4')::uuid,'urgent','unreviewed','학생의 직접 도움 요청을 먼저 확인합니다.',current_date,'{"demo":true}'::jsonb,target_teacher,now()),
  (md5(target_teacher::text||':demo-signal:5')::uuid,demo_class,'demo-week-5',md5(target_teacher::text||':demo-student:5')::uuid,5,md5(target_teacher::text||':demo-response:0:5')::uuid,'week','conversation_planned','비공개 대화 시간을 잡았습니다.',current_date+2,'{"demo":true}'::jsonb,target_teacher,now()),
  (md5(target_teacher::text||':demo-signal:9')::uuid,demo_class,'demo-closed-9',md5(target_teacher::text||':demo-student:9')::uuid,9,md5(target_teacher::text||':demo-response:0:9')::uuid,'watch','closed','확인 후 특이사항 없음으로 종결했습니다.',current_date-3,'{"demo":true}'::jsonb,target_teacher,now()-interval '3 days');

  -- 설문이 없는 6번 학생도 변화 살펴보기 화면을 확인할 수 있는 진행 기록
  insert into public.observations(
    id,class_id,student_id,student_number,survey_month,title,planned_action,observed_fact,
    teacher_interpretation,interview_note,follow_up,follow_up_date,status,outcome,
    source_type,source_snapshot,signal_review_ids,updated_at
  ) values
  (md5(target_teacher::text||':demo-observation:6')::uuid,demo_class,md5(target_teacher::text||':demo-student:6')::uuid,6,demo_month,
   '수업 참여 장면 확인','모둠 활동 두 차례에서 참여 장면을 살펴봅니다.','','','',
   '다음 주에 참여 기회를 다시 확인합니다.',current_date+5,'doing','pending','manual','{"demo":true}'::jsonb,'{}'::uuid[],now()),
  (md5(target_teacher::text||':demo-observation:9')::uuid,demo_class,md5(target_teacher::text||':demo-student:9')::uuid,9,demo_month,
   '친구와의 대화 장면 확인','쉬는 시간과 모둠 활동을 확인합니다.','친구의 말을 기다린 뒤 자신의 의견을 말했습니다.',
   '최근에는 대화 순서를 안정적으로 조절하는 모습이 관찰됩니다.','학생도 이전보다 편안하다고 말했습니다.',
   '일상적으로 관찰하며 특이사항이 있을 때 다시 확인합니다.',null,'done','no_issue','rule_signal','{"demo":true}'::jsonb,
   array[md5(target_teacher::text||':demo-signal:9')::uuid],now()-interval '2 days');

  -- API 호출 없이 AI 결과 화면을 확인할 수 있는 저장 결과
  insert into public.ai_analysis_runs(
    id,class_id,teacher_id,survey_month,model,response_count,status,review_status,
    result_json,request_id,created_at,completed_at
  ) values (
    md5(target_teacher::text||':demo-ai:'||demo_month)::uuid,demo_class,target_teacher,demo_month,
    'demo-saved-analysis',9,'complete','active',
    jsonb_build_object('analysis',jsonb_build_object(
      'overall_judgment','이번 달에는 도움을 직접 요청한 학생을 먼저 확인하고, 모둠 활동에서 말할 기회가 고르게 주어지는지 함께 살펴보는 것이 좋습니다.',
      'priority_students',jsonb_build_array(
        jsonb_build_object('student','학생-4','priority','즉시 확인','attention_reason','직접 도움을 요청했고 두 친구도 모둠 활동에서 말할 기회가 필요해 보였다고 응답했습니다.','protective_factors',jsonb_build_array('도움을 구체적으로 요청할 수 있습니다.'),'observation_points',jsonb_build_array(jsonb_build_object('context','모둠 활동','behavior','의견을 말하려 할 때 친구들의 반응과 발언 기회','period','이번 주 2~3회')),'coaching_directions',jsonb_build_array('비공개로 먼저 상황을 듣고 원하는 도움을 함께 정합니다.'),'coaching_questions',jsonb_build_array('어떤 순간에 선생님의 도움이 가장 필요했나요?'),'evidence',jsonb_build_array('직접 도움 요청과 학교생활 고민')),
        jsonb_build_object('student','학생-5','priority','이번 주 확인','attention_reason','선생님과 조용히 이야기하고 싶다고 직접 요청했습니다.','observation_points',jsonb_build_array(jsonb_build_object('context','쉬는 시간','behavior','혼자 이야기할 수 있는 시간을 편안하게 선택하는지','period','이번 주')),'coaching_directions',jsonb_build_array('학생이 고른 시간과 장소에서 짧게 대화합니다.'),'coaching_questions',jsonb_build_array('오늘 이야기하고 싶은 것부터 천천히 말해 줄래요?'),'evidence',jsonb_build_array('교사 대화 요청')),
        jsonb_build_object('student','학생-2','priority','관찰','attention_reason','친구 관계 고민과 받은 관계 점수의 변화가 함께 나타났습니다.','observation_points',jsonb_build_array(jsonb_build_object('context','쉬는 시간','behavior','먼저 다가가는 친구와 상대 반응','period','5일')),'coaching_directions',jsonb_build_array('친구를 정해 주기보다 편한 활동과 상대를 탐색하도록 돕습니다.'),'coaching_questions',jsonb_build_array('요즘 함께 있을 때 편한 순간은 언제였나요?'),'evidence',jsonb_build_array('관계 고민과 월별 관계 응답'))
      ),
      'class_patterns',jsonb_build_array(
        jsonb_build_object('pattern','모둠 활동에서 말할 기회를 고르게 만드는 운영이 필요해 보입니다.','evidence',jsonb_build_array('도움 요청과 친구 응답이 같은 장면을 가리킵니다.'),'teacher_check','발언 순서 카드나 돌아가며 말하기를 적용하고 실제 참여 변화를 살펴봅니다.'),
        jsonb_build_object('pattern','친절과 성장에 대한 긍정 언급이 여러 학생에게서 반복됩니다.','evidence',jsonb_build_array('친절·존중 및 긍정적 변화 문항의 구조화된 선택'),'teacher_check','공개적으로 학생을 지목하기보다 학급 전체의 구체적인 행동 기준으로 강화합니다.')
      ),
      'limitations',jsonb_build_array('데모 자료이며 실제 학생에 대한 판단에 사용할 수 없습니다.','응답은 교사의 직접 관찰과 대화로 확인해야 합니다.')
    )),'demo-seed',now(),now()
  );

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason,details)
  values(demo_class,target_teacher,'demo_seed_created','class',demo_class,'비식별 기능 점검 자료 생성',jsonb_build_object('students',10,'months',3));

  raise notice '데모 학급 생성 완료: %, 교사: %', demo_class, target_email;
end $$;
