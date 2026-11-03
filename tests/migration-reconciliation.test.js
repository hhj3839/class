const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const repair=read('supabase/audit/20261103_reconcile_history.sql');
const originalVersions=['20260720090000','20260909120000','20260909150000','20260909160000','20260911150000','20260912100000'];
const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')&&f.slice(0,14)<='20261005100000').sort();

test('audited migration history repair verifies the full replay and fails closed',async t=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    // Supabase platform objects and default grants; no production connection or data.
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create schema extensions;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create function auth.role() returns text language sql as 'select current_user::text';
      create extension pgcrypto with schema extensions;
      set search_path=public,extensions;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
    `);
    for(const name of ['schema.sql','observations_migration.sql','teacher_auth_migration.sql','observation_nullable_student_hotfix.sql','data_governance_migration.sql']){
      await db.exec(read('supabase/'+name).replace('create extension if not exists pgcrypto;',''));
    }
    for(const file of files) await db.exec(read('supabase/migrations/'+file));
    assert.equal(files.length,30);
    for(const version of originalVersions){
      const file=files.find(f=>f.startsWith(version));
      await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[version,file.slice(15,-4),['original-history-sentinel']]);
    }
    const original=(await db.query('select * from supabase_migrations.schema_migrations order by version')).rows;
    await t.test('missing original history blocks repair',async()=>{
      await db.exec("delete from supabase_migrations.schema_migrations where version='20260720090000';");
      await assert.rejects(()=>db.exec(repair),/RECONCILIATION_BLOCKED: original history is incomplete/);
      await db.exec('rollback;');
      assert.equal((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n,5);
      await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[original[0].version,original[0].name,original[0].statements]);
    });
    const failClosed=async (change,undo,category)=>{
      await db.exec(change);
      await assert.rejects(()=>db.exec(repair),new RegExp('RECONCILIATION_BLOCKED: '+category));
      await db.exec('rollback;');
      assert.equal((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n,6);
      await db.exec(undo);
    };
    await t.test('changed function privileges block every history insert',async()=>{
      await failClosed('revoke execute on function public.teacher_get_survey_month_auth(text) from authenticated;',
        'grant execute on function public.teacher_get_survey_month_auth(text) to authenticated;','functions');
    });
    await t.test('missing index blocks every history insert',async()=>{
      await failClosed('drop index public.survey_responses_submission_id_key;',
        'create unique index survey_responses_submission_id_key on public.survey_responses(submission_id) where submission_id is not null;','indexes');
    });
    await t.test('changed column nullability blocks every history insert',async()=>{
      await failClosed('alter table public.students alter column student_id drop not null;',
        'alter table public.students alter column student_id set not null;','columns');
    });
    await t.test('disabled RLS blocks every history insert',async()=>{
      await failClosed('alter table public.classes disable row level security;',
        'alter table public.classes enable row level security;','tables');
    });
    await t.test('conflicting history name is not overwritten',async()=>{
      await failClosed("update supabase_migrations.schema_migrations set name='unexpected' where version='20260720090000';",
        "update supabase_migrations.schema_migrations set name='secure_teacher_context' where version='20260720090000';",'unexpected history');
    });
    await t.test('30 migrations reconcile while preserving all six existing records',async()=>{
      // The reviewed production baseline has no default on this pre-migration column.
      await db.exec('alter table public.survey_responses alter column survey_month drop default;');
      await db.exec(repair);
      const rows=(await db.query('select * from supabase_migrations.schema_migrations order by version')).rows;
      assert.equal(rows.length,30);
      assert.deepEqual(rows.filter(r=>originalVersions.includes(r.version)),original);
      assert.equal(rows.filter(r=>r.statements===null).length,24);
      assert.deepEqual(rows.map(r=>r.version+'_'+r.name+'.sql'),files);
    });
    await t.test('second reconciliation is a no-op',async()=>{
      const before=(await db.query('select * from supabase_migrations.schema_migrations order by version')).rows;
      await db.exec(repair);
      assert.deepEqual((await db.query('select * from supabase_migrations.schema_migrations order by version')).rows,before);
    });
  }finally{await db.close();}
});

