-- 우리반 이음: Supabase Auth 교사 로그인·학급 소유권 마이그레이션
-- 1) Supabase Authentication > Users에서 교사 계정을 먼저 생성합니다.
-- 2) 이 파일을 SQL Editor에서 실행합니다.
-- 3) 앱에서 최초 1회 기존 DB 접근 코드로 학급 소유권을 연결합니다.

alter table public.classes add column if not exists teacher_id uuid references auth.users(id) on delete restrict;
create index if not exists classes_teacher_id_idx on public.classes (teacher_id);

create or replace function public.teacher_claim_class(p_class_id text, p_secret text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare current_teacher uuid := auth.uid();
begin
  if current_teacher is null then raise exception '교사 로그인이 필요합니다.'; end if;
  update public.classes
  set teacher_id = current_teacher
  where class_id = p_class_id
    and teacher_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
    and (teacher_id is null or teacher_id = current_teacher);
  if not found then raise exception '학급 또는 기존 DB 접근 코드를 확인해 주세요.'; end if;
  return true;
end;
$$;

create or replace function public.teacher_get_my_classes()
returns table (class_id text, created_at timestamptz)
language sql security definer set search_path = public, pg_temp
as $$ select c.class_id,c.created_at from public.classes c where c.teacher_id=auth.uid() order by c.created_at; $$;

create or replace function public.teacher_get_responses_auth(p_class_id text)
returns table (id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select r.id,r.student_number,r.student_name,r.survey_month,r.submitted_at,r.payload_json from public.survey_responses r where r.class_id=p_class_id order by r.submitted_at desc;
end;
$$;

create or replace function public.teacher_sync_roster_auth(p_class_id text,p_students jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare synced_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.students set active=false where class_id=p_class_id;
  insert into public.students(class_id,student_number,student_name,active)
  select p_class_id,(item->>'number')::integer,trim(item->>'name'),true from jsonb_array_elements(p_students) item where trim(coalesce(item->>'name',''))<>''
  on conflict(class_id,student_number) do update set student_name=excluded.student_name,active=true;
  get diagnostics synced_count=row_count;
  return synced_count;
end;
$$;

create or replace function public.teacher_get_observations_auth(p_class_id text)
returns setof public.observations
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select * from public.observations where class_id=p_class_id order by updated_at desc;
end;
$$;

create or replace function public.teacher_save_observation_auth(p_class_id text,p_observation jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare saved_id uuid := coalesce(nullif(p_observation->>'id','')::uuid,gen_random_uuid());
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  insert into public.observations(id,class_id,student_number,survey_month,title,planned_action,observed_fact,teacher_interpretation,interview_note,follow_up,follow_up_date,status,updated_at)
  values(saved_id,p_class_id,(p_observation->>'studentNumber')::integer,nullif(p_observation->>'surveyMonth','')::date,p_observation->>'title',coalesce(p_observation->>'plannedAction',''),coalesce(p_observation->>'observedFact',''),coalesce(p_observation->>'teacherInterpretation',''),coalesce(p_observation->>'interviewNote',''),coalesce(p_observation->>'followUp',''),nullif(p_observation->>'followUpDate','')::date,coalesce(nullif(p_observation->>'status',''),'todo'),now())
  on conflict(id) do update set title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,follow_up=excluded.follow_up,follow_up_date=excluded.follow_up_date,status=excluded.status,updated_at=now()
  where observations.class_id=p_class_id;
  return saved_id;
end;
$$;

revoke all on function public.teacher_claim_class(text,text) from public;
revoke all on function public.teacher_get_my_classes() from public;
revoke all on function public.teacher_get_responses_auth(text) from public;
revoke all on function public.teacher_sync_roster_auth(text,jsonb) from public;
revoke all on function public.teacher_get_observations_auth(text) from public;
revoke all on function public.teacher_save_observation_auth(text,jsonb) from public;
grant execute on function public.teacher_claim_class(text,text) to authenticated;
grant execute on function public.teacher_get_my_classes() to authenticated;
grant execute on function public.teacher_get_responses_auth(text) to authenticated;
grant execute on function public.teacher_sync_roster_auth(text,jsonb) to authenticated;
grant execute on function public.teacher_get_observations_auth(text) to authenticated;
grant execute on function public.teacher_save_observation_auth(text,jsonb) to authenticated;
