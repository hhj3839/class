-- 기존 번호 기반 자료를 보존하면서 학생의 영구 UUID를 추가합니다.
alter table public.students add column if not exists student_id uuid default gen_random_uuid();
update public.students set student_id=gen_random_uuid() where student_id is null;
alter table public.students alter column student_id set not null;
create unique index if not exists students_student_id_key on public.students(student_id);

create or replace function public.teacher_get_class_context_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object(
    'classId',c.class_id,'teacherName',c.teacher_name,'schoolYear',c.school_year,
    'grade',c.grade,'classNumber',c.class_number,
    'students',coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'number',s.student_number,'name',s.student_name) order by s.student_number) from public.students s where s.class_id=c.class_id and s.active),'[]'::jsonb)
  ) into result from public.classes c where c.class_id=p_class_id;
  return result;
end;
$$;

alter table public.survey_responses add column if not exists student_id uuid references public.students(student_id) on delete set null;
update public.survey_responses r set student_id=s.student_id from public.students s
where r.student_id is null and s.class_id=r.class_id and s.student_number=r.student_number;
create index if not exists survey_responses_student_id_month_idx on public.survey_responses(student_id,survey_month);

alter table public.observations add column if not exists student_id uuid references public.students(student_id) on delete set null;
update public.observations o set student_id=s.student_id from public.students s
where o.student_id is null and s.class_id=o.class_id and s.student_number=o.student_number;
create index if not exists observations_student_id_idx on public.observations(student_id,updated_at desc);

create or replace function public.assign_stable_student_id()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.student_id is null and new.student_number is not null then
    select s.student_id into new.student_id from public.students s
    where s.class_id=new.class_id and s.student_number=new.student_number;
  end if;
  return new;
end;
$$;
drop trigger if exists survey_responses_stable_student_id on public.survey_responses;
create trigger survey_responses_stable_student_id before insert or update of student_number on public.survey_responses for each row execute function public.assign_stable_student_id();
drop trigger if exists observations_stable_student_id on public.observations;
create trigger observations_stable_student_id before insert or update of student_number on public.observations for each row execute function public.assign_stable_student_id();

drop function if exists public.teacher_get_responses_auth(text);
create function public.teacher_get_responses_auth(p_class_id text)
returns table(id uuid,student_id uuid,student_number integer,student_name text,survey_month date,submitted_at timestamptz,payload_json jsonb,analysis_excluded boolean,correction_note text)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select r.id,r.student_id,r.student_number,r.student_name,r.survey_month,r.submitted_at,r.payload_json,r.analysis_excluded,r.correction_note
  from public.survey_responses r where r.class_id=p_class_id and r.deleted_at is null order by r.submitted_at desc;
end;
$$;
revoke all on function public.teacher_get_responses_auth(text) from public;
grant execute on function public.teacher_get_responses_auth(text) to authenticated;

create or replace function public.teacher_sync_roster_auth(p_class_id text,p_students jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp
as $$
declare synced_count integer;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.students s set student_number=(item->>'number')::integer,student_name=trim(item->>'name')
  from jsonb_array_elements(p_students) item
  where s.class_id=p_class_id and nullif(item->>'studentId','') is not null and s.student_id=(item->>'studentId')::uuid;
  update public.students set active=false where class_id=p_class_id;
  insert into public.students(class_id,student_number,student_name,active,student_id)
  select p_class_id,(item->>'number')::integer,trim(item->>'name'),true,coalesce(nullif(item->>'studentId','')::uuid,gen_random_uuid())
  from jsonb_array_elements(p_students) item where trim(coalesce(item->>'name',''))<>''
  on conflict(class_id,student_number) do update set student_name=excluded.student_name,active=true;
  get diagnostics synced_count=row_count;
  return synced_count;
end;
$$;
