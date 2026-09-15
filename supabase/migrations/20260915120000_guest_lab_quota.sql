-- Public preview is limited to the explicitly approved synthetic class.
begin;
create table if not exists public.guest_lab_usage (
  month date not null,
  kind text not null check(kind in ('analysis','coaching')),
  used integer not null default 0 check(used >= 0),
  primary key(month,kind)
);
alter table public.guest_lab_usage enable row level security;
revoke all on public.guest_lab_usage from public,anon,authenticated;

create or replace function public.guest_lab_quota(p_kind text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date; n integer; cap integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception '권한이 없습니다.'; end if;
  if not exists(select 1 from public.classes c join auth.users u on u.id=c.teacher_id
    where c.class_id='demo-aa891ab949014621' and lower(u.email)='applicant-test@hhj3839.dev')
    then raise exception '가상 학급 설정을 확인해 주세요.'; end if;
  if p_kind is not null then
    if p_kind not in ('analysis','coaching') then raise exception '지원하지 않는 요청입니다.'; end if;
    cap:=case when p_kind='analysis' then 10 else 100 end;
    insert into public.guest_lab_usage(month,kind) values(m,p_kind) on conflict do nothing;
    update public.guest_lab_usage set used=used+1 where month=m and kind=p_kind and used<cap returning used into n;
    if not found then raise exception '게스트 전체의 이번 달 AI 생성 한도를 사용했습니다. 저장된 결과를 이용해 주세요.'; end if;
  end if;
  return jsonb_build_object('month',to_char(m,'YYYY-MM'),
    'analysisRemaining',10-coalesce((select used from public.guest_lab_usage where month=m and kind='analysis'),0),
    'coachingRemaining',100-coalesce((select used from public.guest_lab_usage where month=m and kind='coaching'),0));
end;$$;
revoke all on function public.guest_lab_quota(text) from public,anon,authenticated;
grant execute on function public.guest_lab_quota(text) to service_role;
commit;
