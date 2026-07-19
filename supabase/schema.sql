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
  survey_month date not null default date_trunc('month', current_date)::date,
  submitted_at timestamptz not null default now(),
  client_submitted_at timestamptz,
  payload_json jsonb not null
);

create index if not exists survey_responses_class_time_idx
  on public.survey_responses (class_id, submitted_at desc);

alter table public.survey_responses
  add column if not exists survey_month date;
update public.survey_responses
set survey_month = date_trunc('month', submitted_at)::date
where survey_month is null;
alter table public.survey_responses alter column survey_month set not null;

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
    class_id, student_number, student_name, survey_month, client_submitted_at, payload_json
  ) values (
    p_class_id,
    p_student_number,
    p_student_name,
    to_date(coalesce(nullif(p_payload->>'surveyMonth',''), to_char(current_date,'YYYY-MM')) || '-01','YYYY-MM-DD'),
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
  supplied_secret_hash text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
begin
  if exists (select 1 from public.classes where class_id = p_class_id) then
    if not exists (
      select 1 from public.classes
      where class_id = p_class_id and teacher_secret_hash = supplied_secret_hash
    ) then
      raise exception '교사용 DB 접근 코드가 올바르지 않습니다.';
    end if;
  else
    if not exists (
      select 1 from public.classes where teacher_secret_hash = supplied_secret_hash
    ) then
      raise exception '교사용 DB 접근 코드가 올바르지 않습니다.';
    end if;
    insert into public.classes (class_id, teacher_secret_hash)
    values (p_class_id, supplied_secret_hash);
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

drop function if exists public.teacher_get_responses(text, text);
create function public.teacher_get_responses(
  p_class_id text,
  p_secret text
)
returns table (
  id uuid,
  student_number integer,
  student_name text,
  survey_month date,
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
  select r.id, r.student_number, r.student_name, r.survey_month, r.submitted_at, r.payload_json
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

-- 최초 실행 전 아래 두 자리표시자를 운영 환경 값으로 바꾸세요.
-- 실제 학급명·학생 명단·접근 코드는 공개 저장소에 커밋하지 않습니다.
insert into public.classes (class_id, teacher_secret_hash)
values ('__CLASS_ID__', encode(digest('__TEACHER_DB_CODE__', 'sha256'), 'hex'))
on conflict (class_id) do update
set teacher_secret_hash = excluded.teacher_secret_hash;
