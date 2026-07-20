-- PRD v1.2: 학생 응답의 안전 신호를 교사의 확인 절차와 연결합니다.
-- 신호는 위험 판정이 아니며, 담당 교사가 실제 대화와 관찰로 확인한 상태만 저장합니다.
create table if not exists public.safety_signal_reviews (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  signal_key text not null,
  student_id uuid references public.students(student_id) on delete set null,
  student_number integer,
  source_response_id uuid references public.survey_responses(id) on delete set null,
  signal_type text not null,
  status text not null default 'unreviewed',
  note text not null default '',
  follow_up_date date,
  source_snapshot jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_signal_reviews_status_check check(status in('unreviewed','conversation_planned','fact_checking','support_connected','no_issue','closed')),
  constraint safety_signal_reviews_type_check check(signal_type in('urgent','week','watch')),
  constraint safety_signal_reviews_class_key unique(class_id,signal_key)
);
create index if not exists safety_signal_reviews_class_status_idx on public.safety_signal_reviews(class_id,status,updated_at desc);
alter table public.safety_signal_reviews enable row level security;
revoke all on public.safety_signal_reviews from anon,authenticated;

create or replace function public.teacher_get_signal_reviews_auth(p_class_id text)
returns table(id uuid,signal_key text,student_id uuid,student_number integer,source_response_id uuid,signal_type text,status text,note text,follow_up_date date,source_snapshot jsonb,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select r.id,r.signal_key,r.student_id,r.student_number,r.source_response_id,r.signal_type,r.status,r.note,r.follow_up_date,r.source_snapshot,r.updated_at
  from public.safety_signal_reviews r where r.class_id=p_class_id order by r.updated_at desc;
end;
$$;

create or replace function public.teacher_upsert_signal_review_auth(p_class_id text,p_signal jsonb)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  saved_id uuid;
  saved_key text:=trim(coalesce(p_signal->>'signalKey',''));
  saved_type text:=coalesce(nullif(p_signal->>'signalType',''),'watch');
  saved_status text:=coalesce(nullif(p_signal->>'status',''),'unreviewed');
  saved_student_id uuid;
  saved_student_number integer:=nullif(p_signal->>'studentNumber','')::integer;
  saved_response_id uuid;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if saved_key='' or length(saved_key)>500 then raise exception '올바르지 않은 신호 식별자입니다.'; end if;
  if saved_type not in('urgent','week','watch') then raise exception '올바르지 않은 신호 유형입니다.'; end if;
  if saved_status not in('unreviewed','conversation_planned','fact_checking','support_connected','no_issue','closed') then raise exception '올바르지 않은 확인 상태입니다.'; end if;

  select s.student_id into saved_student_id from public.students s
  where s.class_id=p_class_id and (s.student_id=nullif(p_signal->>'studentId','')::uuid or s.student_number=saved_student_number)
  order by (s.student_id=nullif(p_signal->>'studentId','')::uuid) desc limit 1;
  select r.id into saved_response_id from public.survey_responses r
  where r.class_id=p_class_id and r.id=nullif(p_signal->>'sourceResponseId','')::uuid;

  insert into public.safety_signal_reviews(class_id,signal_key,student_id,student_number,source_response_id,signal_type,status,note,follow_up_date,source_snapshot,updated_by,updated_at)
  values(p_class_id,saved_key,saved_student_id,saved_student_number,saved_response_id,saved_type,saved_status,left(trim(coalesce(p_signal->>'note','')),300),nullif(p_signal->>'followUpDate','')::date,coalesce(p_signal->'sourceSnapshot','{}'::jsonb),auth.uid(),now())
  on conflict(class_id,signal_key) do update set student_id=excluded.student_id,student_number=excluded.student_number,source_response_id=excluded.source_response_id,signal_type=excluded.signal_type,status=excluded.status,note=excluded.note,follow_up_date=excluded.follow_up_date,source_snapshot=excluded.source_snapshot,updated_by=auth.uid(),updated_at=now()
  returning id into saved_id;

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'safety_signal_reviewed','safety_signal_review',saved_id::text,jsonb_build_object('signal_key',saved_key,'status',saved_status,'follow_up_date',p_signal->>'followUpDate'));
  return saved_id;
end;
$$;

revoke all on function public.teacher_get_signal_reviews_auth(text) from public;
revoke all on function public.teacher_upsert_signal_review_auth(text,jsonb) from public;
grant execute on function public.teacher_get_signal_reviews_auth(text) to authenticated;
grant execute on function public.teacher_upsert_signal_review_auth(text,jsonb) to authenticated;
