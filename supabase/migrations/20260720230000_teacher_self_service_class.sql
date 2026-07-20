-- 회원가입한 교사가 관리자 도움 없이 첫 학급을 생성합니다.
create or replace function public.teacher_create_class_auth(
  p_teacher_name text,
  p_school_year integer,
  p_grade integer,
  p_class_number integer
)
returns text language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare new_class_id text;
begin
  if auth.uid() is null then raise exception '교사 로그인이 필요합니다.'; end if;
  if exists(select 1 from public.classes where teacher_id=auth.uid()) then raise exception '이미 담당 학급이 있습니다.'; end if;
  if trim(coalesce(p_teacher_name,''))='' then raise exception '교사 이름을 입력해 주세요.'; end if;
  if p_school_year not between 2020 and 2100 or p_grade not between 1 and 6 or p_class_number not between 1 and 99 then
    raise exception '학년도·학년·반을 확인해 주세요.';
  end if;
  new_class_id:=lower('class-'||p_school_year||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.classes(class_id,teacher_secret_hash,teacher_id,teacher_name,school_year,grade,class_number)
  values(new_class_id,encode(digest(gen_random_uuid()::text,'sha256'),'hex'),auth.uid(),trim(p_teacher_name),p_school_year,p_grade,p_class_number);
  return new_class_id;
end;$$;

revoke all on function public.teacher_create_class_auth(text,integer,integer,integer) from public;
grant execute on function public.teacher_create_class_auth(text,integer,integer,integer) to authenticated;
