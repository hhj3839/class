const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
for(const analysisType of ['class','relationship'])for(const cached of [false,true]){
  test(`${analysisType}: lookup ${cached?'hit':'miss'} never calls AI or reserves quota`,async()=>{
    let handler;const requests=[];
    const context={Response,Request,console,TextEncoder,AbortController,setTimeout,clearTimeout,
      Deno:{serve:fn=>handler=fn,env:{get:name=>name==='OPENAI_API_KEY'?undefined:'test'}},
      fetch:async(url)=>{requests.push(url);if(url.endsWith('/auth/v1/user'))return Response.json({id:'teacher'});
        if(url.includes('/rpc/teacher_get_cached_'))return Response.json(cached?[{id:'saved',result_json:{summary:'저장 결과'},created_at:'2026-09-01'}]:[]);
        throw Error('Unexpected paid or mutation request: '+url);
      }
    };
    vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'')),context);
    const response=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({classId:'demo',month:'2026-09',analysisType,force:false})}));
    const body=await response.json();assert.equal(response.status,200);assert.equal(body.meta.cached,true);
    assert.equal(Boolean(body.empty),!cached);assert.equal(requests.length,2);
  });
}
test('quota reservation requires strict true and follows cache miss return',()=>{
  assert.ok(source.indexOf('if(force!==true)return json({empty:true')<source.indexOf('runId=await callRpc(beginRpc'));
  assert.match(fs.readFileSync('student-coaching.js','utf8'),/action:'load'/);
});
