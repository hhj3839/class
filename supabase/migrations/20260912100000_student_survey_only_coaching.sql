begin;
set local lock_timeout='5s';
-- 학생 설문만 코칭 자료와 변경 감지에 사용합니다. 기존 관찰·면담·적용 결과는 삭제하지 않습니다.
create or replace function public.teacher_get_student_coaching_context_auth(p_class_id text,p_student_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare student_json jsonb; rows_json jsonb; roster_json jsonb; card_json jsonb; feedback_json jsonb; fingerprint text;
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
  fingerprint:=md5(jsonb_build_object('student',student_json,'roster',roster_json,'responses',rows_json)::text);
  select to_jsonb(c) into card_json from public.student_coaching_cards c where c.class_id=p_class_id and c.student_id=p_student_id and c.status='complete' order by c.created_at desc limit 1;
  if card_json->>'deleted_at' is not null then card_json:=null; end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc),'[]'::jsonb) into feedback_json from
    (select f.*,c.id as source_card_id from public.student_coaching_feedback f join public.student_coaching_cards c on c.id=f.card_id
     where c.class_id=p_class_id and c.student_id=p_student_id and c.deleted_at is null order by f.created_at desc limit 5) f;
  return jsonb_build_object('student',student_json,'roster',roster_json,'responses',rows_json,'sourceHash',fingerprint,'card',card_json,'feedback',feedback_json,
    'remaining',greatest(0,100-(select count(*) from public.student_coaching_cards where class_id=p_class_id and created_at>=date_trunc('month',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')));
end;$$;

commit;

