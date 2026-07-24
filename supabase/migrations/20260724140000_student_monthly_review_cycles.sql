-- 월 1회 설문을 담임 확인과 다음 달 비교로 연결합니다.
-- 날짜 예약은 빠른 추가 확인이 필요한 예외에만 사용합니다.
create table if not exists public.student_monthly_review_cycles (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  student_id uuid not null references public.students(student_id) on delete cascade,
  survey_month date not null,
  status text not null default 'needs_review',
  focus_note text not null default '',
  follow_up_date date,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_monthly_review_cycles_status_check
    check(status in('needs_review','reviewed','carry_forward','rapid_followup')),
  constraint student_monthly_review_cycles_month_check
    check(survey_month=date_trunc('month',survey_month)::date),
  constraint student_monthly_review_cycles_class_student_month_key
    unique(class_id,student_id,survey_month),
  constraint student_monthly_review_cycles_rapid_date_check
    check(status<>'rapid_followup' or follow_up_date is not null)
);

create index if not exists student_monthly_review_cycles_class_month_idx
  on public.student_monthly_review_cycles(class_id,survey_month desc,updated_at desc);

alter table public.student_monthly_review_cycles enable row level security;
revoke all on public.student_monthly_review_cycles from anon,authenticated;

create or replace function public.teacher_get_student_review_cycles_auth(p_class_id text)
returns table(
  id uuid,
  student_id uuid,
  survey_month date,
  status text,
  focus_note text,
  follow_up_date date,
  updated_at timestamptz
)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  return query
  select r.id,r.student_id,r.survey_month,r.status,r.focus_note,r.follow_up_date,r.updated_at
  from public.student_monthly_review_cycles r
  where r.class_id=p_class_id
  order by r.survey_month desc,r.updated_at desc;
end;
$$;

create or replace function public.teacher_upsert_student_review_cycle_auth(
  p_class_id text,
  p_student_id uuid,
  p_survey_month date,
  p_status text,
  p_focus_note text default '',
  p_follow_up_date date default null
)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  saved_id uuid;
  saved_month date:=date_trunc('month',p_survey_month)::date;
  saved_note text:=left(trim(coalesce(p_focus_note,'')),300);
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  if not exists(select 1 from public.students where class_id=p_class_id and student_id=p_student_id and active) then
    raise exception '담당 학급의 학생을 찾을 수 없습니다.';
  end if;
  if p_status not in('needs_review','reviewed','carry_forward','rapid_followup') then
    raise exception '올바르지 않은 담임 확인 상태입니다.';
  end if;
  if p_status in('carry_forward','rapid_followup') and saved_note='' then
    raise exception '다시 살펴볼 내용을 입력해 주세요.';
  end if;
  if p_status='rapid_followup' and p_follow_up_date is null then
    raise exception '빠른 추가 확인 날짜를 입력해 주세요.';
  end if;

  insert into public.student_monthly_review_cycles(
    class_id,student_id,survey_month,status,focus_note,follow_up_date,updated_by,updated_at
  )
  values(
    p_class_id,p_student_id,saved_month,p_status,saved_note,
    case when p_status='rapid_followup' then p_follow_up_date else null end,
    auth.uid(),now()
  )
  on conflict(class_id,student_id,survey_month) do update set
    status=excluded.status,
    focus_note=excluded.focus_note,
    follow_up_date=excluded.follow_up_date,
    updated_by=auth.uid(),
    updated_at=now()
  returning id into saved_id;

  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(
    p_class_id,auth.uid(),'student_monthly_review_updated','student_monthly_review',saved_id::text,
    jsonb_build_object(
      'student_id',p_student_id,
      'survey_month',saved_month,
      'status',p_status,
      'has_focus_note',saved_note<>'',
      'follow_up_date',case when p_status='rapid_followup' then p_follow_up_date else null end
    )
  );
  return saved_id;
end;
$$;

revoke all on function public.teacher_get_student_review_cycles_auth(text) from public;
revoke all on function public.teacher_upsert_student_review_cycle_auth(text,uuid,date,text,text,date) from public;
grant execute on function public.teacher_get_student_review_cycles_auth(text) to authenticated;
grant execute on function public.teacher_upsert_student_review_cycle_auth(text,uuid,date,text,text,date) to authenticated;
