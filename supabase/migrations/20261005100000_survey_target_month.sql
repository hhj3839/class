begin;
alter table public.classes add column if not exists survey_target_month date
  check (survey_target_month is null or extract(day from survey_target_month)=1);

create or replace function public.teacher_get_survey_month_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.classes%rowtype;
begin
 select * into c from public.classes where class_id=p_class_id and teacher_id=auth.uid();
 if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
 return jsonb_build_object('month',to_char(coalesce(c.survey_target_month,date_trunc('month',now() at time zone 'Asia/Seoul')::date),'YYYY-MM'),'automatic',c.survey_target_month is null);
end;$$;

create or replace function public.teacher_set_survey_month_auth(p_class_id text,p_month date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_month is not null and (extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>date_trunc('month',now() at time zone 'Asia/Seoul')::date) then
  raise exception '설문 대상 월은 2000년 1월부터 이번 달까지 선택할 수 있습니다.';
 end if;
 update public.classes set survey_target_month=p_month where class_id=p_class_id and teacher_id=auth.uid();
 if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
 insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
 values(p_class_id,auth.uid(),'survey_target_month_set','class',p_class_id,jsonb_build_object('month',p_month,'automatic',p_month is null));
 return public.teacher_get_survey_month_auth(p_class_id);
end;$$;

create or replace function public.get_survey_month_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_month date;
begin
 select coalesce(survey_target_month,date_trunc('month',now() at time zone 'Asia/Seoul')::date) into target_month from public.classes where participation_token=p_token;
 if not found then raise exception '참여 링크를 확인해 주세요.'; end if;
 return jsonb_build_object('month',to_char(target_month,'YYYY-MM'));
end;$$;

create or replace function public.submit_response_by_token(p_token uuid,p_student_number integer,p_student_name text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target_class text; target_student_id uuid; new_id uuid; target_month date; target_submission_id uuid; saved_payload jsonb;
begin
 select c.class_id,s.student_id,coalesce(c.survey_target_month,date_trunc('month',now() at time zone 'Asia/Seoul')::date)
 into target_class,target_student_id,target_month from public.classes c join public.students s on s.class_id=c.class_id
 where c.participation_token=p_token and s.student_number=p_student_number and s.student_name=p_student_name and s.active
 for share of c;
 if target_class is null then raise exception '참여 링크 또는 학생 정보를 확인할 수 없습니다.'; end if;
 begin target_submission_id=(p_payload->>'submissionId')::uuid;
 exception when invalid_text_representation then raise exception '제출 식별자가 올바르지 않습니다.'; end;
 if target_submission_id is null then raise exception '제출 식별자가 필요합니다.'; end if;
 -- A successful submission retry remains successful even after the teacher changes the month.
 select id into new_id from public.survey_responses where submission_id=target_submission_id and class_id=target_class and student_id=target_student_id;
 if new_id is not null then return new_id; end if;
 if p_payload->>'surveyMonth' is distinct from to_char(target_month,'YYYY-MM') then
  raise exception '선생님이 설문 대상 월을 변경했습니다. 작성 내용은 이 탭에 남아 있습니다. 선생님께 확인한 뒤 새로고침해 주세요.';
 end if;
 saved_payload=jsonb_set(p_payload,'{surveyMonth}',to_jsonb(to_char(target_month,'YYYY-MM')),true);
 insert into public.survey_responses(class_id,student_id,student_number,student_name,survey_month,payload_json,submission_id,submitted_at)
 values(target_class,target_student_id,p_student_number,p_student_name,target_month,saved_payload,target_submission_id,now())
 on conflict(submission_id) where submission_id is not null do nothing returning id into new_id;
 if new_id is null then
  select id into new_id from public.survey_responses where submission_id=target_submission_id and class_id=target_class and student_id=target_student_id;
 end if;
 if new_id is null then raise exception '제출 식별자가 다른 응답에서 이미 사용되었습니다.'; end if;
 return new_id;
end;$$;

revoke all on function public.teacher_get_survey_month_auth(text) from public,anon;
revoke all on function public.teacher_set_survey_month_auth(text,date) from public,anon;
revoke all on function public.get_survey_month_by_token(uuid) from public;
revoke all on function public.submit_response_by_token(uuid,integer,text,jsonb) from public;
grant execute on function public.teacher_get_survey_month_auth(text) to authenticated;
grant execute on function public.teacher_set_survey_month_auth(text,date) to authenticated;
grant execute on function public.get_survey_month_by_token(uuid) to anon,authenticated;
grant execute on function public.submit_response_by_token(uuid,integer,text,jsonb) to anon,authenticated;
commit;
