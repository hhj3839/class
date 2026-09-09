begin;
set local lock_timeout='5s';
create table if not exists public.student_coaching_cards (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(class_id) on delete cascade,
  student_id uuid not null references public.students(student_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  source_hash text not null,
  basis_month text not null,
  status text not null default 'pending' check(status in('pending','complete','failed')),
  result_json jsonb not null default '{}'::jsonb,
  model text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);
create index if not exists student_coaching_lookup on public.student_coaching_cards(class_id,student_id,created_at desc);
create unique index if not exists student_coaching_pending on public.student_coaching_cards(class_id,student_id) where status='pending';
create table if not exists public.student_coaching_feedback (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.student_coaching_cards(id) on delete cascade,
  status text not null check(status in('not_tried','helpful','needs_change')),
  note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default now()
);
alter table public.student_coaching_cards enable row level security;
alter table public.student_coaching_feedback enable row level security;
revoke all on public.student_coaching_cards,public.student_coaching_feedback from anon,authenticated;

create or replace function public.teacher_get_student_coaching_context_auth(p_class_id text,p_student_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student_json jsonb; rows_json jsonb; observations_json jsonb; roster_json jsonb; card_json jsonb; feedback_json jsonb; fingerprint text;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object('studentId',student_id,'number',student_number,'name',student_name,'transferredOn',transferred_on) into student_json
    from public.students where class_id=p_class_id and student_id=p_student_id and (active or transferred_on is not null);
  if student_json is null then raise exception '학생을 찾을 수 없습니다.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('number',student_number,'name',student_name,'studentId',student_id) order by student_number),'[]'::jsonb) into roster_json from public.students where class_id=p_class_id;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into rows_json from public.survey_responses r
    where r.class_id=p_class_id and r.deleted_at is null and not r.analysis_excluded
    and r.survey_month>=date_trunc('month',now() at time zone 'Asia/Seoul')::date-interval '11 months'
    and r.survey_month<=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into observations_json from public.observations o
    where o.class_id=p_class_id and o.student_id=p_student_id and o.deleted_at is null
    and o.survey_month>=date_trunc('month',now() at time zone 'Asia/Seoul')::date-interval '11 months'
    and o.survey_month<=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
  fingerprint:=md5(jsonb_build_object('student',student_json,'roster',roster_json,'responses',rows_json,'observations',observations_json)::text);
  select to_jsonb(c) into card_json from public.student_coaching_cards c where c.class_id=p_class_id and c.student_id=p_student_id and c.status='complete' order by c.created_at desc limit 1;
  if card_json->>'deleted_at' is not null then card_json:=null; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc),'[]'::jsonb) into feedback_json from
    (select f.*,c.id as source_card_id from public.student_coaching_feedback f join public.student_coaching_cards c on c.id=f.card_id
     where c.class_id=p_class_id and c.student_id=p_student_id and c.deleted_at is null order by f.created_at desc limit 5) f;
  return jsonb_build_object('student',student_json,'roster',roster_json,'responses',rows_json,'observations',observations_json,'sourceHash',fingerprint,'card',card_json,'feedback',feedback_json,
    'remaining',greatest(0,10-(select count(*) from public.student_coaching_cards where class_id=p_class_id and created_at>=date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')));
end;$$;

create or replace function public.teacher_begin_student_coaching_auth(p_class_id text,p_student_id uuid,p_source_hash text,p_basis_month text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare context jsonb; new_id uuid;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('student-coaching:'||p_class_id,0));
  context:=public.teacher_get_student_coaching_context_auth(p_class_id,p_student_id);
  if p_source_hash is distinct from context->>'sourceHash' then raise exception '자료가 변경되었습니다. 다시 불러와 주세요.'; end if;
  if p_basis_month is null or p_basis_month!~'^\d{4}-(0[1-9]|1[0-2])$' then raise exception '자료 기준 월을 확인해 주세요.'; end if;
  update public.student_coaching_cards set status='failed',completed_at=now() where class_id=p_class_id and status='pending' and created_at<now()-interval '3 minutes';
  if exists(select 1 from public.student_coaching_cards where class_id=p_class_id and student_id=p_student_id and status='pending') then raise exception '이미 코칭 카드를 생성 중입니다.'; end if;
  if (context->>'remaining')::integer<=0 then raise exception '이번 달 학생 코칭 생성 한도(학급당 10회)를 사용했습니다. 저장 카드를 이용해 주세요.'; end if;
  insert into public.student_coaching_cards(class_id,student_id,teacher_id,source_hash,basis_month) values(p_class_id,p_student_id,auth.uid(),p_source_hash,p_basis_month) returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id) values(p_class_id,auth.uid(),'student_coaching_started','student_coaching',new_id::text);
  return new_id;
end;$$;

create or replace function public.teacher_finish_student_coaching_auth(p_class_id text,p_card_id uuid,p_result jsonb,p_model text,p_success boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.student_coaching_cards;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select * into target from public.student_coaching_cards where class_id=p_class_id and id=p_card_id and teacher_id=auth.uid() and status='pending' for update;
  if not found then raise exception '처리할 생성 요청을 찾을 수 없습니다.'; end if;
  if p_success and target.source_hash is distinct from public.teacher_get_student_coaching_context_auth(p_class_id,target.student_id)->>'sourceHash' then raise exception '생성 중 자료가 변경되었습니다. 다시 불러와 주세요.'; end if;
  if p_success and (jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>40000) then raise exception '카드 결과가 올바르지 않습니다.'; end if;
  update public.student_coaching_cards set status=case when p_success then 'complete' else 'failed' end,result_json=case when p_success then p_result else '{}'::jsonb end,model=left(coalesce(p_model,''),100),completed_at=now() where id=p_card_id;
  return true;
end;$$;

create or replace function public.teacher_record_student_coaching_feedback_auth(p_class_id text,p_card_id uuid,p_status text,p_note text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes c join public.student_coaching_cards a on a.class_id=c.class_id where c.class_id=p_class_id and c.teacher_id=auth.uid() and a.id=p_card_id and a.status='complete' and a.deleted_at is null) then raise exception '담당 학급의 코칭 카드를 찾을 수 없습니다.'; end if;
  if p_status is null or p_status not in('not_tried','helpful','needs_change') or length(coalesce(p_note,''))>1000 then raise exception '적용 결과를 확인해 주세요.'; end if;
  insert into public.student_coaching_feedback(card_id,status,note) values(p_card_id,p_status,trim(coalesce(p_note,'')));
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details) values(p_class_id,auth.uid(),'student_coaching_feedback','student_coaching',p_card_id::text,jsonb_build_object('status',p_status));
  return true;
end;$$;

create or replace function public.teacher_delete_student_coaching_auth(p_class_id text,p_card_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  update public.student_coaching_cards set deleted_at=now(),result_json='{}'::jsonb where class_id=p_class_id and id=p_card_id and deleted_at is null and status<>'pending';
  if not found then raise exception '삭제할 카드를 찾을 수 없습니다.'; end if;
  delete from public.student_coaching_feedback where card_id=p_card_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id) values(p_class_id,auth.uid(),'student_coaching_deleted','student_coaching',p_card_id::text);
  return true;
end;$$;
revoke all on function public.teacher_get_student_coaching_context_auth(text,uuid),public.teacher_begin_student_coaching_auth(text,uuid,text,text),public.teacher_finish_student_coaching_auth(text,uuid,jsonb,text,boolean),public.teacher_record_student_coaching_feedback_auth(text,uuid,text,text),public.teacher_delete_student_coaching_auth(text,uuid) from public,anon;
grant execute on function public.teacher_get_student_coaching_context_auth(text,uuid),public.teacher_begin_student_coaching_auth(text,uuid,text,text),public.teacher_finish_student_coaching_auth(text,uuid,jsonb,text,boolean),public.teacher_record_student_coaching_feedback_auth(text,uuid,text,text),public.teacher_delete_student_coaching_auth(text,uuid) to authenticated;
commit;
