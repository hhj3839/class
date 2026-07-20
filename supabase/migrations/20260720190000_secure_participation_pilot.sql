-- 3차 개선: 추측 불가능한 학생 참여 토큰과 파일럿 준비도
alter table public.classes add column if not exists participation_token uuid not null default gen_random_uuid();
create unique index if not exists classes_participation_token_key on public.classes(participation_token);

create or replace function public.get_roster_by_token(p_token uuid)
returns table(number integer,name text) language sql security definer set search_path=public,pg_temp as $$
  select s.student_number,s.student_name from public.students s join public.classes c on c.class_id=s.class_id
  where c.participation_token=p_token and s.active order by s.student_number;
$$;

create or replace function public.submit_response_by_token(p_token uuid,p_student_number integer,p_student_name text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target_class text;target_student_id uuid;new_id uuid;target_month date;
begin
  select c.class_id,s.student_id into target_class,target_student_id from public.classes c join public.students s on s.class_id=c.class_id
  where c.participation_token=p_token and s.student_number=p_student_number and s.student_name=p_student_name and s.active;
  if target_class is null then raise exception '참여 링크 또는 학생 정보를 확인할 수 없습니다.'; end if;
  target_month=coalesce(to_date(nullif(p_payload->>'surveyMonth','')||'-01','YYYY-MM-DD'),date_trunc('month',now())::date);
  insert into public.survey_responses(class_id,student_id,student_number,student_name,survey_month,payload_json)
  values(target_class,target_student_id,p_student_number,p_student_name,target_month,p_payload) returning id into new_id;
  return new_id;
end;$$;

create or replace function public.teacher_rotate_participation_token_auth(p_class_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_token uuid:=gen_random_uuid();
begin
  update public.classes set participation_token=new_token where class_id=p_class_id and teacher_id=auth.uid();
  if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id) values(p_class_id,auth.uid(),'participation_token_rotated','class',p_class_id);
  return new_token;
end;$$;

create or replace function public.teacher_get_class_context_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object('classId',c.class_id,'teacherName',c.teacher_name,'schoolYear',c.school_year,'grade',c.grade,'classNumber',c.class_number,'participationToken',c.participation_token,
    'students',coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'number',s.student_number,'name',s.student_name) order by s.student_number) from public.students s where s.class_id=c.class_id and s.active),'[]'::jsonb))
  into result from public.classes c where c.class_id=p_class_id;
  return result;
end;$$;

create or replace function public.teacher_get_pilot_readiness_auth(p_class_id text)
returns table(has_participation_token boolean,student_count integer,response_months integer,latest_participation_rate integer,observation_count integer,ai_complete_count integer,last_backup_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare latest_month date;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select max(r.survey_month) into latest_month from public.survey_responses r where r.class_id=p_class_id and r.deleted_at is null;
  return query select c.participation_token is not null,
    (select count(*)::integer from public.students s where s.class_id=p_class_id and s.active),
    (select count(distinct r.survey_month)::integer from public.survey_responses r where r.class_id=p_class_id and r.deleted_at is null and not r.analysis_excluded),
    coalesce((select round(count(distinct r.student_id)*100.0/nullif((select count(*) from public.students s where s.class_id=p_class_id and s.active),0))::integer from public.survey_responses r where r.class_id=p_class_id and r.survey_month=latest_month and r.deleted_at is null and not r.analysis_excluded),0),
    (select count(*)::integer from public.observations o where o.class_id=p_class_id),
    (select count(*)::integer from public.ai_analysis_runs a where a.class_id=p_class_id and a.status='complete'),
    (select max(a.created_at) from public.audit_logs a where a.class_id=p_class_id and a.action='backup_export')
  from public.classes c where c.class_id=p_class_id;
end;$$;

revoke all on function public.get_roster_by_token(uuid) from public;
revoke all on function public.submit_response_by_token(uuid,integer,text,jsonb) from public;
revoke all on function public.teacher_rotate_participation_token_auth(text) from public;
revoke all on function public.teacher_get_pilot_readiness_auth(text) from public;
grant execute on function public.get_roster_by_token(uuid) to anon,authenticated;
grant execute on function public.submit_response_by_token(uuid,integer,text,jsonb) to anon,authenticated;
grant execute on function public.teacher_rotate_participation_token_auth(text) to authenticated;
grant execute on function public.teacher_get_pilot_readiness_auth(text) to authenticated;

-- 이전 class ID 기반 공개 진입을 닫습니다. 새 학생 페이지는 토큰 함수만 사용합니다.
revoke execute on function public.get_roster(text) from anon,authenticated;
revoke execute on function public.submit_response(text,integer,text,jsonb) from anon,authenticated;
