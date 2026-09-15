const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('guest gateway rejects arbitrary writes, classes, and endpoints',async()=>{
 const {guestOperation,CLASS_ID}=await import('../supabase/functions/guest-lab/policy.mjs');
 for(const name of ['teacher_soft_delete_response_auth','teacher_sync_roster_auth','teacher_rotate_participation_token_auth','teacher_export_class_backup_auth','teacher_delete_student_coaching_auth'])assert.throws(()=>guestOperation({kind:'rpc',name,payload:{p_class_id:CLASS_ID}}));
 assert.throws(()=>guestOperation({kind:'rpc',name:'teacher_get_responses_auth',payload:{p_class_id:'private'}}));
 assert.throws(()=>guestOperation({kind:'edge',name:'arbitrary'}));
 assert.deepEqual(guestOperation({kind:'rpc',name:'teacher_get_responses_auth',payload:{p_class_id:CLASS_ID,secret:'not-forwarded'}}).payload,{p_class_id:CLASS_ID});
});
test('guest AI generation shares one class and coaching bucket; reads are free',async()=>{
 const {guestOperation}=await import('../supabase/functions/guest-lab/policy.mjs');
 for(const analysisType of ['class','relationship'])assert.equal(guestOperation({kind:'edge',name:'analyze-class',payload:{month:'2026-09',analysisType,force:true}}).charge,'analysis');
 assert.equal(guestOperation({kind:'edge',name:'analyze-class',payload:{month:'2026-09'}}).charge,null);
 assert.throws(()=>guestOperation({kind:'edge',name:'analyze-class',payload:{month:'2026-99',force:true}}));
 for(const action of ['load','generate'])assert.equal(guestOperation({kind:'edge',name:'student-coaching',payload:{studentId:'11111111-1111-1111-1111-111111111111',action}}).charge,action==='load'?null:'coaching');
});
test('public context cannot disclose writable participation tokens or owner secrets',async()=>{
 const {publicContext}=await import('../supabase/functions/guest-lab/policy.mjs');
 const value=publicContext({teacherSecret:'secret',participationToken:'token',teacher_id:'owner',students:[]});
 assert.ok(!JSON.stringify(value).includes('secret'));assert.ok(!JSON.stringify(value).includes('token'));assert.ok(!JSON.stringify(value).includes('owner'));
});
test('guest quota is service-only, atomic, monthly Korea time and fixed limits',()=>{
 const sql=fs.readFileSync('supabase/migrations/20260915120000_guest_lab_quota.sql','utf8');
 for(const expected of ['Asia/Seoul','service_role','used=used+1','used<cap','then 10 else 100','from public,anon,authenticated'])assert.ok(sql.includes(expected));
 const ui=fs.readFileSync('guest-access.js','utf8');assert.ok(!/setTeacherSession\(|access_token:|localStorage|sessionStorage/.test(ui));
});
async function harness({full=false}={}){
 const vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module'),policy=await import('../supabase/functions/guest-lab/policy.mjs');let handler;const calls=[];
 const fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(url.includes('guest_lab_quota'))return new Response(JSON.stringify(full&&body.p_kind?{message:'게스트 전체의 이번 달 AI 생성 한도를 사용했습니다.'}:{month:'2026-09',analysisRemaining:10,coachingRemaining:100}),{status:full&&body.p_kind?400:200});
  if(url.includes('generate_link'))return new Response(JSON.stringify({email:policy.LAB_EMAIL,hashed_token:'private-hash'}));
  if(url.includes('/verify'))return new Response(JSON.stringify({user:{email:policy.LAB_EMAIL},access_token:'private-token',expires_in:3600}));
  if(url.includes('teacher_get_class_context_auth'))return new Response(JSON.stringify({participationToken:'private-link',students:[]}));
  return new Response(JSON.stringify({card:null,remaining:90}));
 };
 const source=fs.readFileSync('supabase/functions/guest-lab/index.ts','utf8').replace(/^import .*;\r?\n/,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{...policy,fetch,Response,Request,AbortSignal,console,Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://fixture.invalid':'server-only'},serve:fn=>handler=fn}});
 return {calls,invoke:body=>handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(body)}))};
}
test('gateway rejects mutations before auth or DB calls',async()=>{
 const h=await harness();const response=await h.invoke({kind:'rpc',name:'teacher_sync_roster_auth'});assert.equal(response.status,400);assert.equal(h.calls.length,0);
});
test('gateway keeps admin hashes and owner tokens out of public context',async()=>{
 const h=await harness();const response=await h.invoke({kind:'rpc',name:'teacher_get_class_context_auth'});const text=await response.text();assert.equal(response.status,200);assert.ok(!/private-|server-only/.test(text));
});
test('exhausted shared quota prevents upstream AI invocation',async()=>{
 const h=await harness({full:true});const response=await h.invoke({kind:'edge',name:'analyze-class',payload:{month:'2026-09',force:true}});assert.equal(response.status,429);assert.ok(!h.calls.some(c=>c.url.includes('/functions/v1/')));
});
test('stored coaching lookup never reserves quota',async()=>{
 const h=await harness();await h.invoke({kind:'edge',name:'student-coaching',payload:{studentId:'11111111-1111-1111-1111-111111111111',action:'load'}});assert.ok(h.calls.filter(c=>c.url.includes('guest_lab_quota')).every(c=>c.body.p_kind===null));
});
