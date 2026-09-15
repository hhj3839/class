-- Verify against the approved lab; roll back every temporary change.
begin;
set local lock_timeout='5s';
do $$
declare k text:='demo-aa891ab949014621'; owner_id uuid; before_ai jsonb; before_cards jsonb; shifted integer;
begin
 select c.teacher_id into owner_id from public.classes c join auth.users u on u.id=c.teacher_id
 where c.class_id=k and lower(u.email)='applicant-test@hhj3839.dev' for update of c;
 if owner_id is null then raise exception 'Approved lab missing'; end if;
 select jsonb_agg(to_jsonb(a) order by a.id) into before_ai from public.ai_analysis_runs a where class_id=k;
 select jsonb_agg(to_jsonb(c) order by c.id) into before_cards from public.student_coaching_cards c where class_id=k;
 if before_ai is null then raise exception 'AI fixture missing'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 update public.survey_responses set survey_month=(survey_month-interval '1 month')::date where class_id=k;
 shifted:=public.teacher_roll_demo_months_forward_auth(k);
 if shifted<>1 then raise exception 'Expected one month rollover'; end if;
 if before_ai is distinct from (select jsonb_agg(to_jsonb(a) order by a.id) from public.ai_analysis_runs a where class_id=k) then raise exception 'AI history changed'; end if;
 if before_cards is distinct from (select jsonb_agg(to_jsonb(c) order by c.id) from public.student_coaching_cards c where class_id=k) then raise exception 'Coaching history changed'; end if;
 if public.teacher_roll_demo_months_forward_auth(k)<>0 then raise exception 'Rollover is not idempotent'; end if;
 if exists(select 1 from public.students where class_id=k and student_number in (11,12)) then raise exception 'Removed students returned'; end if;
end $$;
rollback;
