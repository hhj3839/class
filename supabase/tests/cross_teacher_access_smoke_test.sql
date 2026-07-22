-- 운영 자료를 변경하지 않고 서로 다른 실제 Auth 교사의 학급 접근 차단을 재시험합니다.
do $$
declare
  target_class text;
  owner_teacher uuid;
  other_teacher uuid;
  access_succeeded boolean := false;
begin
  select c.class_id,c.teacher_id into target_class,owner_teacher
  from public.classes c where c.teacher_id is not null order by c.created_at limit 1;
  select u.id into other_teacher
  from auth.users u where u.id<>owner_teacher order by u.created_at limit 1;
  if target_class is null or other_teacher is null then raise exception '실계정 두 개와 소유 학급 한 개가 필요합니다.'; end if;
  perform set_config('request.jwt.claim.sub',other_teacher::text,true);
  begin
    perform public.teacher_get_class_context_auth(target_class);
    access_succeeded:=true;
  exception when others then
    if sqlerrm<>'담당 학급에 대한 권한이 없습니다.' then raise; end if;
  end;
  if access_succeeded then raise exception 'ACCESS_CONTROL_TEST_FAILED'; end if;
end $$;
select 'PASS' as cross_teacher_access_control;
