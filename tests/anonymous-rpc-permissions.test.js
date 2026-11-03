const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const migration=migrations.find(f=>f.endsWith('_restrict_anonymous_rpc_execution.sql'));
const allowed=['get_roster_by_token(uuid)','get_survey_month_by_token(uuid)','submit_response_by_token(uuid,integer,text,jsonb)'];
const snapshotSQL=`select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role
  from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
  order by p.oid::regprocedure::text`;

test('anonymous RPC hardening preserves student submission and signed-in access',async t=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create schema extensions;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as
        'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create function auth.role() returns text language sql as
        'select coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''),current_user::text)';
      create extension pgcrypto with schema extensions;
      set search_path=public,extensions;
      grant usage on schema public to anon,authenticated,service_role;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    `);
    for(const file of ['schema.sql','observations_migration.sql','teacher_auth_migration.sql','observation_nullable_student_hotfix.sql','data_governance_migration.sql']){
      await db.exec(read('supabase/'+file).replace('create extension if not exists pgcrypto;',''));
    }
    for(const file of migrations.filter(f=>f<migration)) await db.exec(read('supabase/migrations/'+file));
    const before=(await db.query(snapshotSQL)).rows;
    assert.equal(before.filter(f=>f.anon).length,42);
    await db.exec(read('supabase/migrations/'+migration));
    const after=(await db.query(snapshotSQL)).rows;

    await t.test('only the three student token RPCs remain anonymous',()=>{
      assert.deepEqual(after.filter(f=>f.anon).map(f=>f.signature).sort(),allowed);
      assert.equal(after.filter(f=>!f.anon).length,59);
    });
    await t.test('all function definitions and authenticated/service privileges stay unchanged',()=>{
      const preserved=rows=>rows.map(({anon,...rest})=>rest);
      assert.deepEqual(preserved(after),preserved(before));
    });
    await t.test('no PUBLIC execute grant can bypass the allowlist',async()=>{
      const result=await db.query(`select count(*)::int as n from pg_proc p,
        lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.pronamespace='public'::regnamespace and p.prokind='f'
          and a.grantee=0 and a.privilege_type='EXECUTE'`);
      assert.equal(result.rows[0].n,0);
    });
    await t.test('future postgres-owned functions do not inherit anonymous access',async()=>{
      await db.exec("create function public.permission_default_probe() returns integer language sql as 'select 1';");
      const probe=(await db.query(snapshotSQL)).rows.find(f=>f.signature==='permission_default_probe()');
      assert.equal(probe.anon,false);
      assert.equal(probe.authenticated,true);
      assert.equal(probe.service_role,true);
      await db.exec('drop function public.permission_default_probe();');
    });
    await t.test('real anon role can submit and retry while forbidden access is rejected',async()=>{
      const count=async()=> (await db.query('select count(*)::int as n from public.classes')).rows[0].n;
      const initial=await count();
      await db.exec(read('supabase/tests/anonymous_rpc_permissions_smoke_test.sql'));
      assert.equal(await count(),initial);
      assert.equal((await db.query("select count(*)::int as n from public.classes where class_id like 'permission-smoke-%'")).rows[0].n,0);
    });
    await t.test('signed-in teacher can read owned context but not another teacher context',async()=>{
      await db.exec(`begin;
        insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','synthetic-owner@example.invalid');
        insert into public.classes(class_id,teacher_secret_hash,teacher_id)
          values('permission-owner','synthetic','11111111-1111-4111-8111-111111111111');
        select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
        set local role authenticated;`);
      const context=await db.query("select public.teacher_get_class_context_auth('permission-owner') as value");
      assert.equal(context.rows[0].value.classId,'permission-owner');
      await db.exec("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);");
      await assert.rejects(()=>db.query("select public.teacher_get_class_context_auth('permission-owner')"),/담당 학급에 대한 권한이 없습니다/);
      await db.exec('rollback;');
    });
    await t.test('retired, internal and service-only RPCs remain unavailable to authenticated users',()=>{
      for(const f of after.filter(f=>/before_coaching|guest_lab_quota|student_review_cycle|^year_end_cleanup_snapshot|^get_roster\(|^submit_response\(/.test(f.signature))){
        assert.equal(f.authenticated,false,f.signature);
      }
    });
    await t.test('reapplying the migration leaves the same access matrix',async()=>{
      await db.exec(read('supabase/migrations/'+migration));
      assert.deepEqual((await db.query(snapshotSQL)).rows,after);
    });
  }finally{
    await db.exec('rollback;').catch(()=>{});
    await db.close();
  }
});

