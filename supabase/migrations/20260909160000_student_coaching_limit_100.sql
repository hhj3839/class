begin;
set local lock_timeout='5s';
-- 기존 생성 이력은 유지하고 학생 코칭 한도만 학급당 월 100회로 확대합니다.
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
    'remaining',greatest(0,100-(select count(*) from public.student_coaching_cards where class_id=p_class_id and created_at>=date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')));
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
  if (context->>'remaining')::integer<=0 then raise exception '이번 달 학생 코칭 생성 한도(학급당 100회)를 사용했습니다. 저장 카드를 이용해 주세요.'; end if;
  insert into public.student_coaching_cards(class_id,student_id,teacher_id,source_hash,basis_month) values(p_class_id,p_student_id,auth.uid(),p_source_hash,p_basis_month) returning id into new_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id) values(p_class_id,auth.uid(),'student_coaching_started','student_coaching',new_id::text);
  return new_id;
end;$$;

commit;
