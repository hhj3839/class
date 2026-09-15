-- All test reservations are rolled back. No student data is changed.
begin;
set local lock_timeout='5s';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare m date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date; caught boolean:=false;
begin
  perform public.guest_lab_quota(null);
  insert into public.guest_lab_usage(month,kind,used) values(m,'analysis',9),(m,'coaching',99)
    on conflict(month,kind) do update set used=excluded.used;
  if (public.guest_lab_quota('analysis')->>'analysisRemaining')::integer<>0 then raise exception 'analysis boundary failed'; end if;
  begin perform public.guest_lab_quota('analysis'); exception when others then caught:=position('한도' in sqlerrm)>0; end;
  if not caught then raise exception 'analysis cap failed'; end if;
  if (public.guest_lab_quota('coaching')->>'coachingRemaining')::integer<>0 then raise exception 'coaching boundary failed'; end if;
  caught:=false;
  begin perform public.guest_lab_quota('coaching'); exception when others then caught:=position('한도' in sqlerrm)>0; end;
  if not caught then raise exception 'coaching cap failed'; end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  caught:=false;
  begin perform public.guest_lab_quota(null); exception when others then caught:=position('권한' in sqlerrm)>0; end;
  if not caught then raise exception 'anonymous denial failed'; end if;
end;$$;
rollback;
