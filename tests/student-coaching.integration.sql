-- 가상 학급만 사용하는 롤백 검증. 실학생과 실제 AI 호출은 사용하지 않습니다.
begin;
set local lock_timeout='5s';
do $$
declare owner_id uuid; class_key text:='coaching-check-'||gen_random_uuid(); student_key uuid:=gen_random_uuid(); other_student uuid:=gen_random_uuid(); response_key uuid; context jsonb; fingerprint text; card_id uuid; denied boolean; i integer;
begin
  select id into owner_id from auth.users limit 1;
  if owner_id is null then raise exception '테스트 교사 계정이 없습니다.'; end if;
  insert into public.classes(class_id,teacher_id,teacher_secret_hash,teacher_name) values(class_key,owner_id,'unused','가상 교사');
  insert into public.students(class_id,student_id,student_number,student_name) values(class_key,student_key,1,'가상 학생');
  insert into public.survey_responses(class_id,student_id,student_number,student_name,survey_month,payload_json)
    values(class_key,student_key,1,'가상 학생',date_trunc('month',now())::date,'{"studentState":{"worryDetail":"발표 연습을 하고 싶어요."}}') returning id into response_key;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  context:=public.teacher_get_student_coaching_context_auth(class_key,student_key);fingerprint:=context->>'sourceHash';
  if (context->>'remaining')::integer<>10 then raise exception '초기 횟수 오류'; end if;
  denied:=false;begin perform public.teacher_get_student_coaching_context_auth(class_key,other_student);exception when others then denied:=true;end;if not denied then raise exception '다른 학생 식별자 차단 실패';end if;
  card_id:=public.teacher_begin_student_coaching_auth(class_key,student_key,fingerprint,to_char(now(),'YYYY-MM'));
  denied:=false;begin perform public.teacher_begin_student_coaching_auth(class_key,student_key,fingerprint,to_char(now(),'YYYY-MM'));exception when others then denied:=true;end;if not denied then raise exception '중복 생성 차단 실패';end if;
  update public.survey_responses set correction_note='가상 정정' where id=response_key;
  denied:=false;begin perform public.teacher_finish_student_coaching_auth(class_key,card_id,'{}','fixture',true);exception when others then denied:=true;end;if not denied then raise exception '생성 중 자료 변경 차단 실패';end if;
  perform public.teacher_finish_student_coaching_auth(class_key,card_id,'{}','fixture',false);
  context:=public.teacher_get_student_coaching_context_auth(class_key,student_key);fingerprint:=context->>'sourceHash';
  card_id:=public.teacher_begin_student_coaching_auth(class_key,student_key,fingerprint,to_char(now(),'YYYY-MM'));
  perform public.teacher_finish_student_coaching_auth(class_key,card_id,'{"summary":"가상 카드"}','fixture',true);
  perform public.teacher_record_student_coaching_feedback_auth(class_key,card_id,'helpful','가상 적용 결과');
  context:=public.teacher_get_student_coaching_context_auth(class_key,student_key);
  if context#>>'{card,id}'<>card_id::text or jsonb_array_length(context->'feedback')<>1 or context->>'sourceHash'<>fingerprint then raise exception '카드·적용 결과 조회 실패';end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied:=false;begin perform public.teacher_get_student_coaching_context_auth(class_key,student_key);exception when others then denied:=true;end;if not denied then raise exception '다른 교사 조회 차단 실패';end if;
  denied:=false;begin perform public.teacher_record_student_coaching_feedback_auth(class_key,card_id,'helpful','실패해야 함');exception when others then denied:=true;end;if not denied then raise exception '다른 교사 기록 차단 실패';end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.teacher_delete_student_coaching_auth(class_key,card_id);
  context:=public.teacher_get_student_coaching_context_auth(class_key,student_key);
  if context->'card'<>'null'::jsonb or jsonb_array_length(context->'feedback')<>0 then raise exception '카드 삭제 실패';end if;
  for i in 1..8 loop card_id:=public.teacher_begin_student_coaching_auth(class_key,student_key,fingerprint,to_char(now(),'YYYY-MM'));perform public.teacher_finish_student_coaching_auth(class_key,card_id,'{}','fixture',false);end loop;
  denied:=false;begin perform public.teacher_begin_student_coaching_auth(class_key,student_key,fingerprint,to_char(now(),'YYYY-MM'));exception when others then denied:=true;end;if not denied then raise exception '월간 한도 차단 실패';end if;
  if (select count(*) from public.survey_responses where class_id=class_key)<>1 then raise exception '원본 자료 보존 실패';end if;
  if has_function_privilege('anon','public.teacher_get_student_coaching_context_auth(text,uuid)','execute') then raise exception '익명 권한 오류';end if;
  if has_table_privilege('authenticated','public.student_coaching_cards','SELECT') then raise exception '직접 테이블 접근 오류';end if;
end;$$;
rollback;
