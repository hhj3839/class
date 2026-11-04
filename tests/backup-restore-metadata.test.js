const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('backup round trip preserves transfer and observation metadata, tombstones and ownership',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql as 'select current_user::text';
      create extension pgcrypto with schema extensions; set search_path=public,extensions;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
      insert into auth.users values(gen_random_uuid(),'lab-manager-test@hhj3839.dev');`);
    for(const name of ['schema.sql','observations_migration.sql','teacher_auth_migration.sql','observation_nullable_student_hotfix.sql','data_governance_migration.sql']){
      await db.exec(read('supabase/'+name).replace('create extension if not exists pgcrypto;',''));
    }
    for(const name of fs.readdirSync(path.join(__dirname,'../supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
      if(name.endsWith('_preserve_backup_restore_metadata.sql')){
        await assert.rejects(()=>db.exec(read('tests/backup-restore-metadata.integration.sql')),/Transfer date lost/);
        await db.exec('rollback;');
      }
      await db.exec(read('supabase/migrations/'+name));
    }
    await db.exec(read('tests/backup-restore-metadata.integration.sql'));
    await db.exec(read('tests/coaching-backup.integration.sql'));
  }finally{await db.close();}
});
