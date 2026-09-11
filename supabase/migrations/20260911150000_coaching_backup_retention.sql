-- 기존 복구 동작을 보존하고 코칭 자료를 추가합니다. 실제 자료 삭제는 실행하지 않습니다.
begin;
set local lock_timeout='5s';
do $$ begin
  if to_regprocedure('public.class_backup_export_before_coaching(text)') is null then
    alter function public.teacher_export_class_backup_auth(text) rename to class_backup_export_before_coaching;
    alter function public.teacher_restore_class_backup_auth(text,jsonb) rename to class_backup_restore_before_coaching;
    alter function public.year_end_cleanup_snapshot(text) rename to year_end_snapshot_before_coaching;
    alter function public.teacher_delete_year_end_data_auth(text,text,text,text) rename to year_end_delete_before_coaching;
  end if;
end $$;
revoke all on function public.class_backup_export_before_coaching(text),public.class_backup_restore_before_coaching(text,jsonb),public.year_end_snapshot_before_coaching(text),public.year_end_delete_before_coaching(text,text,text,text) from public,anon,authenticated;

create or replace function public.teacher_export_class_backup_auth(p_class_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  result:=public.class_backup_export_before_coaching(p_class_id);
  return result||jsonb_build_object('coachingBackupVersion',1,
    'coachingCards',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.student_coaching_cards c where c.class_id=p_class_id),'[]'::jsonb),
    'coachingFeedback',coalesce((select jsonb_agg(to_jsonb(f) order by f.id) from public.student_coaching_feedback f join public.student_coaching_cards c on c.id=f.card_id where c.class_id=p_class_id and c.deleted_at is null),'[]'::jsonb));
end $$;

create or replace function public.teacher_restore_class_backup_auth(p_class_id text,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; card jsonb; feedback jsonb; student_key uuid; source_card uuid; target_card uuid;
  card_map jsonb:='{}'; cards_count integer:=0; feedback_count integer:=0; affected integer;
  same_class boolean:=p_backup->>'classId'=p_class_id;
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  if p_backup->>'format' is distinct from 'class-ieum-backup-v1' then raise exception '지원하지 않는 백업 형식입니다.'; end if;
  if jsonb_typeof(coalesce(p_backup->'coachingCards','[]'))<>'array' or jsonb_typeof(coalesce(p_backup->'coachingFeedback','[]'))<>'array' then raise exception '코칭 백업 형식이 올바르지 않습니다.'; end if;
  result:=public.class_backup_restore_before_coaching(p_class_id,p_backup);
  for card in select value from jsonb_array_elements(coalesce(p_backup->'coachingCards','[]')) loop
    source_card:=(card->>'id')::uuid;
    select s.student_id into student_key from public.students s
      join jsonb_array_elements(p_backup->'students') b on s.student_number=(b->>'student_number')::integer
      where s.class_id=p_class_id and b->>'student_id'=card->>'student_id';
    if student_key is null or source_card is null then raise exception '코칭 카드의 학생 연결을 복구할 수 없습니다.'; end if;
    target_card:=case when same_class then source_card else gen_random_uuid() end;
    insert into public.student_coaching_cards(id,class_id,student_id,teacher_id,source_hash,basis_month,status,result_json,model,created_at,completed_at,deleted_at)
    values(target_card,p_class_id,student_key,auth.uid(),
      case when same_class then card->>'source_hash' else 'restored:'||source_card::text end,
      card->>'basis_month',case when card->>'status'='pending' then 'failed' else card->>'status' end,
      case when card->>'deleted_at' is not null then '{}'::jsonb else coalesce(card->'result_json','{}') end,
      coalesce(card->>'model',''),(card->>'created_at')::timestamptz,(card->>'completed_at')::timestamptz,(card->>'deleted_at')::timestamptz)
    on conflict(id) do nothing;
    get diagnostics affected=row_count;
    cards_count:=cards_count+affected;
    -- 다른 학급 ID 충돌이나 삭제된 카드에는 적용 결과를 연결하지 않습니다.
    if exists(select 1 from public.student_coaching_cards where id=target_card and class_id=p_class_id and student_id=student_key and deleted_at is null) then
      card_map:=card_map||jsonb_build_object(source_card::text,target_card);
    end if;
  end loop;
  for feedback in select value from jsonb_array_elements(coalesce(p_backup->'coachingFeedback','[]')) loop
    target_card:=(card_map->>(feedback->>'card_id'))::uuid;
    if target_card is null then continue; end if;
    insert into public.student_coaching_feedback(id,card_id,status,note,created_at)
    values(case when same_class then (feedback->>'id')::uuid else gen_random_uuid() end,target_card,feedback->>'status',coalesce(feedback->>'note',''),(feedback->>'created_at')::timestamptz)
    on conflict(id) do nothing;
    get diagnostics affected=row_count; feedback_count:=feedback_count+affected;
  end loop;
  insert into public.audit_logs(class_id,teacher_id,action,target_type,target_id,details)
  values(p_class_id,auth.uid(),'coaching_backup_restore','class',p_class_id,jsonb_build_object('cards',cards_count,'feedback',feedback_count,'crossClass',not same_class));
  return result||jsonb_build_object('coachingCards',cards_count,'coachingFeedback',feedback_count,'coachingRequiresNewAnalysis',not same_class);
end $$;

create or replace function public.year_end_cleanup_snapshot(p_class_id text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select public.year_end_snapshot_before_coaching(p_class_id)||jsonb_build_object(
    'coachingCards',(select count(*) from public.student_coaching_cards where class_id=p_class_id),
    'coachingFeedback',(select count(*) from public.student_coaching_feedback f join public.student_coaching_cards c on c.id=f.card_id where c.class_id=p_class_id),
    'coachingFingerprint',md5(jsonb_build_object(
      'cards',(select jsonb_agg(to_jsonb(c) order by c.id) from public.student_coaching_cards c where c.class_id=p_class_id),
      'feedback',(select jsonb_agg(to_jsonb(f) order by f.id) from public.student_coaching_feedback f join public.student_coaching_cards c on c.id=f.card_id where c.class_id=p_class_id))::text));
$$;

create or replace function public.teacher_delete_year_end_data_auth(p_class_id text,p_fingerprint text,p_class_label text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.classes where class_id=p_class_id and teacher_id=auth.uid()) then raise exception '담당 학급에 대한 권한이 없습니다.'; end if;
  -- 검증과 삭제 사이의 코칭 변경을 막습니다. 조회는 계속 허용합니다.
  perform set_config('lock_timeout','5s',true);
  lock table public.student_coaching_cards,public.student_coaching_feedback in share row exclusive mode;
  -- 기존 학년도·확인 문구·지문 검사를 유지합니다. 학생 삭제 시 외래키가 코칭 자료도 정리합니다.
  return public.year_end_delete_before_coaching(p_class_id,p_fingerprint,p_class_label,p_confirmation);
end $$;
revoke all on function public.teacher_export_class_backup_auth(text),public.teacher_restore_class_backup_auth(text,jsonb),public.year_end_cleanup_snapshot(text),public.teacher_delete_year_end_data_auth(text,text,text,text) from public,anon,authenticated;
grant execute on function public.teacher_export_class_backup_auth(text),public.teacher_restore_class_backup_auth(text,jsonb),public.teacher_delete_year_end_data_auth(text,text,text,text) to authenticated;
commit;
