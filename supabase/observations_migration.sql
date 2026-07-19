-- 우리반 이음: 관찰 기록 DB 저장 1차 마이그레이션
-- Supabase SQL Editor에서 한 번 실행한 뒤 프런트엔드 DB 연동을 활성화합니다.

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  student_number integer not null,
  survey_month date,
  title text not null,
  planned_action text not null default '',
  observed_fact text not null default '',
  teacher_interpretation text not null default '',
  interview_note text not null default '',
  follow_up text not null default '',
  follow_up_date date,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists observations_class_status_idx
  on public.observations (class_id, status, updated_at desc);

alter table public.observations enable row level security;
revoke all on public.observations from anon, authenticated;

create or replace function public.teacher_get_observations(p_class_id text, p_secret text)
returns setof public.observations
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.classes
    where class_id = p_class_id
      and teacher_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then raise exception '교사용 DB 접근 코드가 올바르지 않습니다.'; end if;
  return query select * from public.observations where class_id = p_class_id order by updated_at desc;
end;
$$;

create or replace function public.teacher_save_observation(
  p_class_id text, p_secret text, p_observation jsonb
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare saved_id uuid := coalesce(nullif(p_observation->>'id','')::uuid, gen_random_uuid());
begin
  if not exists (
    select 1 from public.classes
    where class_id = p_class_id
      and teacher_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then raise exception '교사용 DB 접근 코드가 올바르지 않습니다.'; end if;

  insert into public.observations (
    id,class_id,student_number,survey_month,title,planned_action,observed_fact,
    teacher_interpretation,interview_note,follow_up,follow_up_date,status,updated_at
  ) values (
    saved_id,p_class_id,(p_observation->>'studentNumber')::integer,
    nullif(p_observation->>'surveyMonth','')::date,p_observation->>'title',
    coalesce(p_observation->>'plannedAction',''),coalesce(p_observation->>'observedFact',''),
    coalesce(p_observation->>'teacherInterpretation',''),coalesce(p_observation->>'interviewNote',''),
    coalesce(p_observation->>'followUp',''),nullif(p_observation->>'followUpDate','')::date,
    coalesce(nullif(p_observation->>'status',''),'todo'),now()
  )
  on conflict (id) do update set
    title=excluded.title,planned_action=excluded.planned_action,observed_fact=excluded.observed_fact,
    teacher_interpretation=excluded.teacher_interpretation,interview_note=excluded.interview_note,
    follow_up=excluded.follow_up,follow_up_date=excluded.follow_up_date,status=excluded.status,updated_at=now()
  where observations.class_id=p_class_id;
  return saved_id;
end;
$$;

revoke all on function public.teacher_get_observations(text,text) from public;
revoke all on function public.teacher_save_observation(text,text,jsonb) from public;
grant execute on function public.teacher_get_observations(text,text) to anon, authenticated;
grant execute on function public.teacher_save_observation(text,text,jsonb) to anon, authenticated;
