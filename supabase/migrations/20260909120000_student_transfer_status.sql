-- 전출은 삭제가 아닙니다. 응답·관찰 기록은 변경하지 않습니다.
begin;
alter table public.students add column if not exists transferred_on date;

-- 명단 동기화가 전출 학생을 다시 활성화하지 않도록 DB에서 보장합니다.
create or replace function public.enforce_student_transfer_status()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.transferred_on is not null then new.active=false; end if;
  return new;
end;$$;
create or replace trigger student_transfer_status_guard
before insert or update on public.students
for each row execute function public.enforce_student_transfer_status();
revoke all on function public.enforce_student_transfer_status() from public;

create or replace function public.teacher_set_student_transfer_auth(p_class_id text,p_student_id uuid,p_transferred_on date)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_date date; previous_active boolean;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then
    raise exception '담당 학급에 대한 권한이 없습니다.';
  end if;
  if p_transferred_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '미래 날짜로 전출을 예약할 수 없습니다.';
  end if;
  select transferred_on,active into previous_date,previous_active from public.students
    where class_id=p_class_id and student_id=p_student_id for update;
  if not found then raise exception '학생을 찾을 수 없습니다.'; end if;
  if previous_date is null and not previous_active then raise exception '명단에서 제외된 학생은 전출 처리할 수 없습니다.'; end if;
  if previous_date is not distinct from p_transferred_on then return true; end if;
  update public.students set transferred_on=p_transferred_on,active=(p_transferred_on is null)
    where class_id=p_class_id and student_id=p_student_id;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
    values(p_class_id,auth.uid(),case when p_transferred_on is null then 'student_transfer_cancel' else 'student_transfer' end,
      'student',p_student_id::text,jsonb_build_object('previous_date',previous_date,'transferred_on',p_transferred_on));
  return true;
end;$$;
revoke all on function public.teacher_set_student_transfer_auth(text,uuid,date) from public,anon;
grant execute on function public.teacher_set_student_transfer_auth(text,uuid,date) to authenticated;

create or replace function public.teacher_get_class_context_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  select jsonb_build_object('classId',c.class_id,'teacherName',c.teacher_name,'schoolYear',c.school_year,'grade',c.grade,'classNumber',c.class_number,'participationToken',c.participation_token,
    'students',coalesce((select jsonb_agg(jsonb_build_object('studentId',s.student_id,'number',s.student_number,'name',s.student_name,'transferredOn',s.transferred_on) order by s.student_number)
      from public.students s where s.class_id=c.class_id and (s.active or s.transferred_on is not null)),'[]'::jsonb))
  into result from public.classes c where c.class_id=p_class_id;
  return result;
end;$$;
revoke all on function public.teacher_get_class_context_auth(text) from public,anon;
grant execute on function public.teacher_get_class_context_auth(text) to authenticated;
commit;
