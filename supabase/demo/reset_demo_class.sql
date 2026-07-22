-- 시험용 교사 계정의 데모 학급만 삭제합니다. 운영 학급은 삭제하지 않습니다.
do $$
declare
  target_email constant text := 'REPLACE_WITH_TEST_TEACHER_EMAIL';
  target_teacher uuid;
  demo_class text;
begin
  if target_email = concat('REPLACE_WITH_TEST','_TEACHER_EMAIL') then
    raise exception 'target_email을 실제 시험용 교사 이메일로 바꿔 주세요.';
  end if;
  select id into target_teacher from auth.users where lower(email)=lower(target_email) order by created_at limit 1;
  if target_teacher is null then raise exception '시험용 교사 계정을 찾을 수 없습니다: %',target_email; end if;
  demo_class := 'demo-' || substr(replace(target_teacher::text, '-', ''), 1, 16);
  delete from public.classes where class_id=demo_class and teacher_id=target_teacher and class_id like 'demo-%';
  if not found then raise exception '이 계정에 연결된 데모 학급이 없습니다.'; end if;
  raise notice '데모 학급 삭제 완료: %',demo_class;
end $$;
