-- 학생 기기의 연속 클릭·네트워크 재시도로 같은 응답이 중복 저장되지 않도록 합니다.
alter table public.survey_responses add column if not exists submission_id uuid;
create unique index if not exists survey_responses_submission_id_key
  on public.survey_responses(submission_id)
  where submission_id is not null;

create or replace function public.submit_response_by_token(p_token uuid,p_student_number integer,p_student_name text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  target_class text;
  target_student_id uuid;
  new_id uuid;
  target_month date;
  target_submission_id uuid;
begin
  select c.class_id,s.student_id into target_class,target_student_id
  from public.classes c join public.students s on s.class_id=c.class_id
  where c.participation_token=p_token
    and s.student_number=p_student_number
    and s.student_name=p_student_name
    and s.active;
  if target_class is null then raise exception '참여 링크 또는 학생 정보를 확인할 수 없습니다.'; end if;

  begin
    target_submission_id=(p_payload->>'submissionId')::uuid;
  exception when invalid_text_representation then
    raise exception '제출 식별자가 올바르지 않습니다.';
  end;
  if target_submission_id is null then raise exception '제출 식별자가 필요합니다.'; end if;

  target_month=coalesce(to_date(nullif(p_payload->>'surveyMonth','')||'-01','YYYY-MM-DD'),date_trunc('month',now())::date);
  insert into public.survey_responses(class_id,student_id,student_number,student_name,survey_month,payload_json,submission_id)
  values(target_class,target_student_id,p_student_number,p_student_name,target_month,p_payload,target_submission_id)
  on conflict(submission_id) where submission_id is not null do nothing
  returning id into new_id;

  if new_id is null then
    select r.id into new_id from public.survey_responses r
    where r.submission_id=target_submission_id and r.class_id=target_class and r.student_id=target_student_id;
  end if;
  if new_id is null then raise exception '제출 식별자가 다른 응답에서 이미 사용되었습니다.'; end if;
  return new_id;
end;
$$;

revoke all on function public.submit_response_by_token(uuid,integer,text,jsonb) from public;
grant execute on function public.submit_response_by_token(uuid,integer,text,jsonb) to anon,authenticated;
