const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const migration=files.find(f=>f.endsWith('_reconcile_legacy_schema.sql'));
const definitionsSQL="select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,p.proacl as acl from pg_proc p where p.pronamespace='public'::regnamespace order by 1";
async function baseline(){
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.role() returns text language sql as 'select current_user::text';
    create extension pgcrypto with schema extensions;
    set search_path=public,extensions;
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
  for(const f of ['schema.sql','observations_migration.sql','teacher_auth_migration.sql','observation_nullable_student_hotfix.sql','data_governance_migration.sql']){
    await db.exec(read('supabase/'+f).replace('create extension if not exists pgcrypto;',''));
  }
  for(const f of files.filter(f=>f<migration))await db.exec(read('supabase/migrations/'+f));
  return db;
}
async function assertFinalState(db){
  const col=(await db.query("select column_default,is_nullable from information_schema.columns where table_schema='public' and table_name='survey_responses' and column_name='survey_month'")).rows[0];
  assert.equal(col.column_default,null);
  assert.equal(col.is_nullable,'NO');
  const permissions=(await db.query(`select relrowsecurity as rls,
    has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon,
    has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as authenticated,
    has_table_privilege('service_role',oid,'SELECT') as service
    from pg_class where oid='public.ai_analysis_limit_overrides'::regclass`)).rows[0];
  assert.deepEqual(permissions,{rls:true,anon:false,authenticated:false,service:true});
  assert.equal((await db.query("select count(*)::int as n from pg_constraint where conrelid='public.ai_analysis_limit_overrides'::regclass and contype in ('p','f','c')")).rows[0].n,4);
  assert.equal((await db.query("select count(*)::int as n from pg_proc where pronamespace='public'::regnamespace and prosrc ilike '%ai_analysis_limit_overrides%'")).rows[0].n,0);
}
test('fresh setup reconciles retired table and requires explicit survey month',async t=>{
  const db=await baseline();
  try{
    assert.equal((await db.query("select to_regclass('public.ai_analysis_limit_overrides') as name")).rows[0].name,null);
    const before=(await db.query(definitionsSQL)).rows;
    await db.exec(read('supabase/migrations/'+migration));
    await t.test('tracked retired table has RLS, constraints and server-only access',async()=>assertFinalState(db));
    await t.test('reconciliation leaves all application functions and grants unchanged',async()=>{
      assert.deepEqual((await db.query(definitionsSQL)).rows,before);
    });
    await t.test('month omission fails while anonymous past-month submission and retry work',async()=>{
      await db.exec(read('supabase/tests/survey_month_explicit_smoke_test.sql'));
      assert.equal((await db.query("select count(*)::int as n from public.classes where class_id like 'month-smoke-%'")).rows[0].n,0);
    });
    await t.test('general anonymous survey security smoke still passes',async()=>{
      await db.exec(read('supabase/tests/anonymous_rpc_permissions_smoke_test.sql'));
    });
  }finally{await db.exec('rollback;').catch(()=>{});await db.close();}
});
test('production-shaped retired history survives reconciliation and reapplication',async t=>{
  const db=await baseline();
  try{
    // Reproduce the audited six-column production table independently of the new migration.
    await db.exec(`create table public.ai_analysis_limit_overrides(
      teacher_id uuid not null references auth.users(id) on delete cascade,
      class_id text not null references public.classes(class_id) on delete cascade,
      monthly_limit integer not null check(monthly_limit between 10 and 100),
      expires_at timestamptz not null,reason text not null,created_at timestamptz not null default now(),
      primary key(teacher_id,class_id));
      alter table public.ai_analysis_limit_overrides enable row level security;
      revoke all on public.ai_analysis_limit_overrides from public,anon,authenticated;
      insert into auth.users(id,email) values('33333333-3333-4333-8333-333333333333','history-fixture@example.invalid');
      insert into public.classes(class_id,teacher_secret_hash) values('history-fixture','synthetic');
      insert into public.ai_analysis_limit_overrides values(
        '33333333-3333-4333-8333-333333333333','history-fixture',20,now()-interval '1 day','synthetic retired record',now()-interval '2 days');
      alter table public.survey_responses alter column survey_month drop default;`);
    const before=(await db.query('select to_jsonb(t) as record from public.ai_analysis_limit_overrides t')).rows;
    await t.test('existing expired record and ownership remain intact',async()=>{
      await db.exec(read('supabase/migrations/'+migration));
      assert.deepEqual((await db.query('select to_jsonb(t) as record from public.ai_analysis_limit_overrides t')).rows,before);
      await assertFinalState(db);
    });
    await t.test('reapplying changes neither historical data nor final permissions',async()=>{
      await db.exec(read('supabase/migrations/'+migration));
      assert.deepEqual((await db.query('select to_jsonb(t) as record from public.ai_analysis_limit_overrides t')).rows,before);
      await assertFinalState(db);
    });
  }finally{await db.close();}
});

