-- 기존 시험 자료를 초기화하지 않는 체험 상태 보완. 지정 계정의 demo 학급만 허용.
begin;
set local lock_timeout='5s';
do $$
declare
  class_key constant text:='demo-aa891ab949014621';
  owner_id uuid;
  transfer_id uuid;
  empty_id uuid;
  previous_month date:=(date_trunc('month',current_date)-interval '1 month')::date;
begin
  select c.teacher_id into owner_id from public.classes c join auth.users u on u.id=c.teacher_id
    where c.class_id=class_key and c.class_id like 'demo-%' and lower(u.email)='applicant-test@hhj3839.dev';
  if owner_id is null then raise exception '지정된 시험 계정의 실험실 학급이 아닙니다.'; end if;
  transfer_id:=md5(owner_id::text||':demo-experience:transfer')::uuid;
  empty_id:=md5(owner_id::text||':demo-experience:empty')::uuid;
  -- 월 이동으로 미래가 된 수동 데모 예시가 실제 AI 생성 결과를 가리지 않게 한다.
  -- 실제 생성 결과와 설문 날짜는 변경하지 않는다.
  update public.ai_analysis_runs
    set created_at=least(created_at,date_trunc('month',current_date)),
        completed_at=least(completed_at,date_trunc('month',current_date))
    where class_id=class_key and teacher_id=owner_id and model='demo-saved-analysis';
  if exists(select 1 from public.students where class_id=class_key and student_number in(11,12)
      and student_id not in(transfer_id,empty_id)) then raise exception '11·12번 학생이 이미 사용 중입니다. 기존 자료는 변경하지 않습니다.'; end if;
  insert into public.students(class_id,student_id,student_number,student_name,active,transferred_on)
    values(class_key,transfer_id,11,'가상전출',false,(date_trunc('month',current_date)-interval '1 day')::date),
          (class_key,empty_id,12,'가상새봄',true,null)
    on conflict(student_id) do nothing;
  insert into public.survey_responses(id,class_id,student_id,student_number,student_name,survey_month,payload_json)
    values(md5(owner_id::text||':demo-experience:transfer-response')::uuid,class_key,transfer_id,11,'가상전출',previous_month,
      jsonb_build_object('studentNumber',11,'studentName','가상전출','surveyMonth',to_char(previous_month,'YYYY-MM'),
        'studentState',jsonb_build_object('worryDetail','가상 체험 자료: 새 학교에서 친구에게 먼저 말을 걸어 보고 싶어요.','teacherWish','천천히 해도 괜찮다고 말해 주세요.'),
        'selfRatings',jsonb_build_object('study',jsonb_build_object('score',3,'reason','가상 체험 자료: 모르는 문제는 질문해 보고 싶어요.')),
        'relationships','[]'::jsonb)) on conflict(id) do nothing;
  -- 반복 실행해도 감사 기록과 시험 응답을 중복 생성하지 않는다.
  if not exists(select 1 from public.audit_logs where class_id=class_key and action='demo_experience_enriched') then
    insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason,details)
      values(class_key,owner_id,'demo_experience_enriched','class',class_key,'가상 전출·미응답 체험 상태 추가',
        jsonb_build_object('added_student_numbers',jsonb_build_array(11,12),'existing_responses_preserved',true));
  end if;
end $$;
commit;
