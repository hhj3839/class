const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
for(const analysisType of ['class','relationship'])for(const cached of [false,true]){
  test(`${analysisType}: lookup ${cached?'hit':'miss'} never calls AI or reserves quota`,async()=>{
    let handler;const requests=[];
    const context={...await import('../supabase/functions/analyze-class/localization.mjs'),...await import('../supabase/functions/analyze-class/grounding.mjs'),Response,Request,console,TextEncoder,AbortController,setTimeout,clearTimeout,
      Deno:{serve:fn=>handler=fn,env:{get:name=>name==='OPENAI_API_KEY'?undefined:'test'}},
      fetch:async(url)=>{requests.push(url);if(url.endsWith('/auth/v1/user'))return Response.json({id:'teacher'});
        if(url.includes('/rpc/teacher_get_cached_'))return Response.json(cached?[{id:'saved',result_json:{summary:'저장 결과'},created_at:'2026-09-01'}]:[]);
        throw Error('Unexpected paid or mutation request: '+url);
      }
    };
    vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'')),context);
    const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({classId:'demo',month:'2026-09',analysisType,force:false})}));
    const body=await response.json();assert.equal(response.status,200);assert.equal(body.meta.cached,true);
    assert.equal(Boolean(body.empty),!cached||analysisType==='class');assert.equal(requests.length,2);
  });
}
test('quota reservation requires strict true and follows cache miss return',()=>{
  assert.ok(source.indexOf('if(force!==true)return json({empty:true')<source.indexOf('runId=await callRpc(beginRpc'));
  assert.match(fs.readFileSync('student-coaching.js','utf8'),/action:'load'/);
});

test('이전 판단 검증 버전과 현재 버전의 잘못된 저장 판단은 유료 호출 없이 숨긴다',async()=>{
 const grounding=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=[{id:'r3',student_number:3,survey_month:'2026-09-01',payload_json:{peerObservations:{growth:{detail:'친구가 친절해짐'}}}}];
 const fingerprint=await grounding.fingerprintRows(rows,'2026-09');
 for(const version of ['2026.10.30-survey-grounding-v1',grounding.GROUNDING_VERSION]){
  let handler;const calls=[];
  const context={...grounding,...await import('../supabase/functions/analyze-class/localization.mjs'),IeumRelationshipData:require('../supabase/functions/analyze-class/relationship-data.js'),Response,Request,DOMException,console,
   Deno:{serve:fn=>handler=fn,env:{get:()=> 'test'}},
   fetch:async url=>{calls.push(url);
    if(url.endsWith('/auth/v1/user'))return Response.json({id:'teacher'});
    if(url.includes('/rpc/teacher_get_cached_'))return Response.json([{id:'saved',result_json:{_grounding_version:version,_source_fingerprint:fingerprint,priority_students:[{student:'학생-3',priority:'즉시 확인',source_refs:['r3|peerObservations.growth.detail']}],class_patterns:[]}}]);
    if(url.endsWith('/rpc/teacher_get_responses_auth'))return Response.json(rows);
    throw Error('Unexpected mutation or paid request');
   }};
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'')),context);
  const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({classId:'demo',month:'2026-09',force:false})}));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.validationBlocked,true);assert.equal(body.analysis,null);
  assert.ok(calls.every(url=>!url.includes('openai')&&!url.includes('begin_')&&!url.includes('complete_')));
 }
});
