-- 교사 기본정보와 명단을 브라우저 저장소 대신 담당 학급 DB에서 조회합니다.
alter table public.classes add column if not exists teacher_name text not null default '';
alter table public.classes add column if not exists school_year integer not null default extract(year from current_date)::integer;
alter table public.classes add column if not exists grade integer not null default 1 check(grade between 1 and 6);
alter table public.classes add column if not exists class_number integer not null default 1 check(class_number between 1 and 99);

create or replace function public.teacher_get_class_context_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object(
    'classId',c.class_id,'teacherName',c.teacher_name,'schoolYear',c.school_year,
    'grade',c.grade,'classNumber',c.class_number,
    'students',coalesce((select jsonb_agg(jsonb_build_object('number',s.student_number,'name',s.student_name) order by s.student_number) from public.students s where s.class_id=c.class_id and s.active),'[]'::jsonb)
  ) into result from public.classes c where c.class_id=p_class_id;
  return result;
end;
$$;

create or replace function public.teacher_update_class_context_auth(p_class_id text,p_teacher_name text,p_school_year integer,p_grade integer,p_class_number integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if trim(coalesce(p_teacher_name,''))='' then raise exception '교사 이름을 입력해 주세요.'; end if;
  update public.classes set teacher_name=trim(p_teacher_name),school_year=p_school_year,grade=p_grade,class_number=p_class_number where class_id=p_class_id and teacher_id=auth.uid();
  if not found then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return true;
end;
$$;

revoke all on function public.teacher_get_class_context_auth(text) from public;
revoke all on function public.teacher_update_class_context_auth(text,text,integer,integer,integer) from public;
grant execute on function public.teacher_get_class_context_auth(text) to authenticated;
grant execute on function public.teacher_update_class_context_auth(text,text,integer,integer,integer) to authenticated;
