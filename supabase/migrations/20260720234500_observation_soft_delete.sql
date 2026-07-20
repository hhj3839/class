-- 관찰 기록은 감사 가능한 소프트 삭제를 사용합니다.
alter table public.observations add column if not exists deleted_at timestamptz;
alter table public.observations add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.observations add column if not exists deletion_reason text not null default '';
create index if not exists observations_active_class_idx on public.observations(class_id,updated_at desc) where deleted_at is null;

create or replace function public.teacher_get_observations_auth(p_class_id text)
returns setof public.observations
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  return query select * from public.observations where class_id=p_class_id and deleted_at is null order by updated_at desc;
end;
$$;

create or replace function public.teacher_soft_delete_observation_auth(p_class_id text,p_observation_id uuid,p_reason text)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception '삭제 사유가 필요합니다.'; end if;
  update public.observations set deleted_at=now(),deleted_by=auth.uid(),deletion_reason=trim(p_reason),updated_at=now()
  where id=p_observation_id and class_id=p_class_id and deleted_at is null;
  if not found then raise exception '삭제할 관찰 기록을 찾을 수 없습니다.'; end if;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,reason)
  values(p_class_id,auth.uid(),'observation_soft_delete','observation',p_observation_id::text,trim(p_reason));
  return true;
end;
$$;

revoke all on function public.teacher_get_observations_auth(text) from public;
revoke all on function public.teacher_soft_delete_observation_auth(text,uuid,text) from public;
grant execute on function public.teacher_get_observations_auth(text) to authenticated;
grant execute on function public.teacher_soft_delete_observation_auth(text,uuid,text) to authenticated;
