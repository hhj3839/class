-- Only random disposable classes are mutated. All fixtures and their audit entries roll back.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare owner_id uuid; src text:='backup-metadata-check-'||gen_random_uuid(); dst text:=src||'-restore';
  sid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); active_oid uuid:=gen_random_uuid();
  ai_id uuid:=gen_random_uuid(); signal_id uuid:=gen_random_uuid(); foreign_ai uuid:=gen_random_uuid(); foreign_signal uuid:=gen_random_uuid();
  backup jsonb; old_backup jsonb; result jsonb; before_hash jsonb:='{}'; after_hash jsonb:='{}';
  t record; h text; denied boolean;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('select md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5(to_jsonb(x)::text) h from public.%I x) a',t.tablename) into h;
    before_hash:=before_hash||jsonb_build_object(t.tablename,h);
  end loop;
  begin
    select id into owner_id from auth.users where email='lab-manager-test@hhj3839.dev';
    if owner_id is null then raise exception 'Known disposable test teacher missing'; end if;
    insert into public.classes(class_id,teacher_id,teacher_secret_hash,teacher_name,school_year,grade,class_number)
      values(src,owner_id,'unused','가상복원교사',2020,3,97),(dst,owner_id,'unused','가상복원교사',2020,3,98);
    insert into public.students(class_id,student_id,student_number,student_name,transferred_on)
      values(src,sid,1,'가상복원학생','2020-07-15');
    insert into public.survey_responses(id,class_id,student_id,student_number,student_name,survey_month,payload_json)
      values(rid,src,sid,1,'가상복원학생','2020-06-01','{"test":"가상 설문 원문"}');
    insert into public.observations(id,class_id,student_id,student_number,survey_month,title,observed_fact,outcome,source_type,source_snapshot,created_at,updated_at,deleted_at,deleted_by,deletion_reason)
      values(oid,src,sid,1,'2020-06-01','가상 삭제 관찰','가상 관찰 원문','support','rule_signal','{"test":"가상 근거"}',
        '2020-06-01','2020-06-02','2020-06-02',owner_id,'가상 삭제'),
      (active_oid,src,sid,1,'2020-06-01','가상 활성 관찰','가상 관찰 원문','continue','manual','{"test":"활성 근거"}',
        '2020-06-01','2020-06-02',null,null,'');
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    insert into public.ai_analysis_runs(id,class_id,teacher_id,survey_month) values(ai_id,src,owner_id,'2020-06-01'),(foreign_ai,dst,owner_id,'2020-06-01');
    insert into public.safety_signal_reviews(id,class_id,signal_key,signal_type,updated_by)
      values(signal_id,src,'test','watch',owner_id),(foreign_signal,dst,'test','watch',owner_id);
    update public.observations set ai_run_id=ai_id,signal_review_ids=array[signal_id] where class_id=src;
    backup:=public.teacher_export_class_backup_auth(src);
    -- Exercise the JSON serialization boundary used by downloaded files.
    backup:=backup::text::jsonb;
    result:=public.teacher_restore_class_backup_auth(dst,backup);
    if (result->>'students')::int<>1 or (result->>'responses')::int<>1 or (result->>'observations')::int<>2 then raise exception 'Restored counts differ'; end if;
    if not exists(select 1 from public.students where class_id=dst and student_id<>sid and transferred_on='2020-07-15' and not active) then raise exception 'Transfer date lost'; end if;
    if not exists(select 1 from public.survey_responses r join public.students s using(class_id,student_id) where r.class_id=dst and r.id<>rid and r.payload_json=backup->'responses'->0->'payload_json') then raise exception 'Response content/link lost'; end if;
    if not exists(select 1 from public.observations where class_id=dst and title='가상 삭제 관찰' and outcome='support' and source_type='rule_signal'
      and source_snapshot='{"test":"가상 근거"}' and created_at='2020-06-01' and updated_at='2020-06-02'
      and deleted_at='2020-06-02' and deletion_reason='가상 삭제' and deleted_by is null and ai_run_id is null and signal_review_ids='{}') then raise exception 'Observation metadata lost'; end if;

    -- Same-class repair and explicit null transfer cancellation.
    update public.students set transferred_on=null,active=true where class_id=src;
    update public.observations set outcome='pending',source_snapshot='{}' where id=active_oid;
    perform public.teacher_restore_class_backup_auth(src,backup);
    if not exists(select 1 from public.students where class_id=src and transferred_on='2020-07-15') then raise exception 'Same-class transfer repair failed'; end if;
    if not exists(select 1 from public.observations where id=active_oid and outcome='continue' and source_snapshot='{"test":"활성 근거"}') then raise exception 'Same-class metadata repair failed'; end if;
    if (select count(*) from public.observations where class_id=src)<>2 then raise exception 'Same-class duplicate'; end if;
    if not exists(select 1 from public.observations where id=active_oid and ai_run_id=ai_id and signal_review_ids=array[signal_id]) then raise exception 'Valid same-class references lost'; end if;
    old_backup:=jsonb_set(backup,'{observations}',(select jsonb_agg(value||jsonb_build_object('ai_run_id',foreign_ai,'signal_review_ids',jsonb_build_array(foreign_signal))) from jsonb_array_elements(backup->'observations')));
    perform public.teacher_restore_class_backup_auth(src,old_backup);
    if exists(select 1 from public.observations where class_id=src and (ai_run_id=foreign_ai or foreign_signal=any(signal_review_ids))) then raise exception 'Foreign-class references accepted'; end if;
    -- Old files lacking newer fields must not erase current metadata.
    old_backup:=jsonb_set(backup,'{students}',(select jsonb_agg(value-'transferred_on') from jsonb_array_elements(backup->'students')));
    old_backup:=jsonb_set(old_backup,'{observations}',(select jsonb_agg(value-'outcome'-'source_type'-'source_snapshot'-'created_at'-'ai_run_id'-'signal_review_ids') from jsonb_array_elements(backup->'observations')));
    perform public.teacher_restore_class_backup_auth(src,old_backup);
    if not exists(select 1 from public.students where class_id=src and transferred_on='2020-07-15') or not exists(select 1 from public.observations where id=active_oid and outcome='continue') then raise exception 'Old backup erased metadata'; end if;
    perform public.teacher_restore_class_backup_auth(src,jsonb_set(jsonb_set(backup,'{students,0,transferred_on}','null'),'{students,0,active}','true'));
    if not exists(select 1 from public.students where class_id=src and transferred_on is null and active) then raise exception 'Explicit transfer cancellation failed'; end if;
    -- A stale backup cannot resurrect a record deleted since export.
    update public.observations set deleted_at=now(),deleted_by=owner_id,deletion_reason='백업 후 삭제' where id=active_oid;
    update public.survey_responses set deleted_at=now(),deleted_by=owner_id where id=rid;
    perform public.teacher_restore_class_backup_auth(src,backup);
    if exists(select 1 from public.observations where id=active_oid and deleted_at is null) or exists(select 1 from public.survey_responses where id=rid and deleted_at is null) then raise exception 'Stale backup resurrected deleted record'; end if;
    perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
    denied:=false; begin perform public.teacher_restore_class_backup_auth(src,backup); exception when others then denied:=true; end;
    if not denied then raise exception 'Foreign teacher allowed'; end if;
    if has_function_privilege('anon','public.teacher_restore_class_backup_auth(text,jsonb)','execute') or has_function_privilege('authenticated','public.class_backup_restore_before_coaching(text,jsonb)','execute') then raise exception 'Internal RPC exposed'; end if;
    raise exception using errcode='ZB001',message='Rollback disposable fixtures';
  exception when sqlstate 'ZB001' then null;
  end;
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('select md5(coalesce(string_agg(h,'''' order by h),'''')) from (select md5(to_jsonb(x)::text) h from public.%I x) a',t.tablename) into h;
    after_hash:=after_hash||jsonb_build_object(t.tablename,h);
  end loop;
  if before_hash<>after_hash then raise exception 'Public data changed after fixture rollback'; end if;
end $$;
rollback;
