create extension if not exists pgcrypto;

create table if not exists public.classes (
  class_id text primary key,
  teacher_secret_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  class_id text not null references public.classes(class_id) on delete cascade,
  student_number integer not null,
  student_name text not null,
  active boolean not null default true,
  primary key (class_id, student_number)
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  student_number integer not null,
  student_name text not null,
  submitted_at timestamptz not null default now(),
  client_submitted_at timestamptz,
  payload_json jsonb not null
);

create index if not exists survey_responses_class_time_idx
  on public.survey_responses (class_id, submitted_at desc);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.survey_responses enable row level security;

revoke all on public.classes from anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.survey_responses from anon, authenticated;

create or replace function public.get_roster(p_class_id text)
returns table (number integer, name text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select student_number, student_name
  from public.students
  where class_id = p_class_id and active
  order by student_number;
$$;

create or replace function public.submit_response(
  p_class_id text,
  p_student_number integer,
  p_student_name text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if not exists (
    select 1 from public.students
    where class_id = p_class_id
      and student_number = p_student_number
      and student_name = p_student_name
      and active
  ) then
    raise exception '학급 명단에서 학생 정보를 확인할 수 없습니다.';
  end if;

  insert into public.survey_responses (
    class_id, student_number, student_name, client_submitted_at, payload_json
  ) values (
    p_class_id,
    p_student_number,
    p_student_name,
    nullif(p_payload->>'submittedAt','')::timestamptz,
    p_payload
  ) returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.teacher_sync_roster(
  p_class_id text,
  p_secret text,
  p_students jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  synced_count integer;
begin
  if not exists (
    select 1 from public.classes
    where class_id = p_class_id
      and teacher_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception '교사용 DB 접근 코드가 올바르지 않습니다.';
  end if;

  delete from public.students where class_id = p_class_id;
  insert into public.students (class_id, student_number, student_name)
  select p_class_id, (item->>'number')::integer, trim(item->>'name')
  from jsonb_array_elements(p_students) item
  where trim(coalesce(item->>'name','')) <> '';

  get diagnostics synced_count = row_count;
  return synced_count;
end;
$$;

create or replace function public.teacher_get_responses(
  p_class_id text,
  p_secret text
)
returns table (
  id uuid,
  student_number integer,
  student_name text,
  submitted_at timestamptz,
  payload_json jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.classes
    where class_id = p_class_id
      and teacher_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception '교사용 DB 접근 코드가 올바르지 않습니다.';
  end if;

  return query
  select r.id, r.student_number, r.student_name, r.submitted_at, r.payload_json
  from public.survey_responses r
  where r.class_id = p_class_id
  order by r.submitted_at desc;
end;
$$;

revoke all on function public.get_roster(text) from public;
revoke all on function public.submit_response(text, integer, text, jsonb) from public;
revoke all on function public.teacher_sync_roster(text, text, jsonb) from public;
revoke all on function public.teacher_get_responses(text, text) from public;

grant execute on function public.get_roster(text) to anon, authenticated;
grant execute on function public.submit_response(text, integer, text, jsonb) to anon, authenticated;
grant execute on function public.teacher_sync_roster(text, text, jsonb) to anon, authenticated;
grant execute on function public.teacher_get_responses(text, text) to anon, authenticated;

insert into public.classes (class_id, teacher_secret_hash)
values ('2026-5-2', encode(digest('__TEACHER_DB_CODE__', 'sha256'), 'hex'))
on conflict (class_id) do update
set teacher_secret_hash = excluded.teacher_secret_hash;

insert into public.students (class_id, student_number, student_name) values
('2026-5-2',1,'김하린'),('2026-5-2',2,'박도윤'),('2026-5-2',3,'이서준'),
('2026-5-2',4,'최유나'),('2026-5-2',5,'정민재'),('2026-5-2',6,'윤서아'),
('2026-5-2',7,'한지우'),('2026-5-2',8,'강민준'),('2026-5-2',9,'송지민'),
('2026-5-2',10,'임다온'),('2026-5-2',11,'오시우'),('2026-5-2',12,'신예린'),
('2026-5-2',13,'조하준'),('2026-5-2',14,'권나윤'),('2026-5-2',15,'안지호'),
('2026-5-2',16,'문서윤'),('2026-5-2',17,'장도현'),('2026-5-2',18,'배유진'),
('2026-5-2',19,'백시온'),('2026-5-2',20,'류아린'),('2026-5-2',21,'차민서'),
('2026-5-2',22,'남도하'),('2026-5-2',23,'유준서'),('2026-5-2',24,'서하은'),
('2026-5-2',25,'진우성'),('2026-5-2',26,'표가은'),('2026-5-2',27,'노현우'),
('2026-5-2',28,'마지안')
on conflict (class_id, student_number) do update
set student_name = excluded.student_name, active = true;
