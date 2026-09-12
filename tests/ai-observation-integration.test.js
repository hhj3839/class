const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const data=require('../supabase/functions/analyze-class/relationship-data.js');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
const students=[1,2,3].map(number=>({number,name:`가상${number}`}));
const rows=['2026-06','2026-07','2026-08'].flatMap(month=>students.map(student=>({id:`${month}-${student.number}`,student_number:student.number,student_name:student.name,survey_month:`${month}-01`,submitted_at:`${month}-15T00:00:00Z`,payload_json:{relationships:students.filter(other=>other.number!==student.number).flatMap(other=>[{targetNumber:other.number,score:1},{targetNumber:other.number,score:5}])}})));
async function harness(type,{cached=null,authorized=true,force=false,roster=students,month='2026-07'}={}){
  let handler,requestBody,saved;const calls=[];
  const fetch=async(url,options={})=>{
    calls.push(url);const body=options.body?JSON.parse(options.body):{};
    if(url.endsWith('/auth/v1/user'))return Response.json(authorized?{id:'fixture'}:{},{status:authorized?200:401});
    if(url.includes('/rpc/teacher_get_cached_'))return Response.json(cached?[cached]:[]);
    if(url.includes('/rpc/teacher_begin_'))return Response.json('run-fixture');
    if(url.endsWith('/rpc/teacher_get_responses_auth'))return Response.json(rows);
    if(url.endsWith('/rpc/teacher_get_class_context_auth'))return Response.json({students:roster});
    if(url.endsWith('/rpc/teacher_complete_ai_analysis_auth')){saved=body;return Response.json(true)}
    if(url==='https://api.openai.com/v1/responses'){
      requestBody=body;
      const output=type==='relationship'?{summary:'친구 관계 응답을 함께 살펴보세요.',insights:[],limitations:[]}:{priority_students:[],class_patterns:[],limitations:[]};
      return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});
    }
    throw new Error(`Unexpected request in mock: ${url}`);
  };
  const {redactStudentNames}=await import('../supabase/functions/analyze-class/privacy.mjs');
  vm.runInNewContext(source,{IeumEnrollment:require('../enrollment-core.js'),IeumRelationshipData:data,redactStudentNames,Response,Request,AbortSignal,fetch,console:{error(){}},Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://mock.invalid':'test-only'},serve:fn=>handler=fn}});
  const response=await handler(new Request('https://mock.invalid/analyze',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify({classId:'fixture',month,analysisType:type,force})}));
  return{status:response.status,result:await response.json(),requestBody,saved,calls};
}
test('전출 이후 인원은 제외하고 이전 달 응답은 유지한다',async()=>{
  const roster=students.map(s=>s.number===3?{...s,transferredOn:'2026-06-30'}:s);
  const result=await harness('relationship',{force:true,roster});
  assert.equal(result.status,200);const input=JSON.parse(result.requestBody.input);
  assert.equal(input.selected_month_summary.response_count,2);
  assert.equal(input.previous_month_summary.response_count,3);
  assert.equal(input.observation_evidence.selected.students.length,2);
  assert.ok(input.observation_evidence.selected.students.every(s=>s.possible_peer_count===1));
});
test('전출 전 달과 전출 월 참여자의 응답을 보존한다',async()=>{
  for(const transferredOn of ['2026-08-15','2026-07-15']){
    const roster=students.map(s=>s.number===3?{...s,transferredOn}:s);
    const result=await harness('relationship',{force:true,roster});
    assert.equal(JSON.parse(result.requestBody.input).selected_month_summary.response_count,3);
  }
});
for(const type of ['class','relationship'])test(`${type} API 경로가 정규화된 관측 근거와 보류 지침을 실제 요청 본문에 넣는다`,async()=>{
  const result=await harness(type,{force:true});assert.equal(result.status,200);assert.ok(result.saved);
  const input=JSON.parse(result.requestBody.input),observations=input.observation_evidence;
  assert.equal(observations.selected.students[0].incoming_response_count,2);
  assert.equal(observations.cumulative.students[0].incoming_response_count,4);
  assert.equal(observations.cumulative.pairs[0].mutual_positive_month_count,2);
  assert.doesNotMatch(JSON.stringify(input),/가상/);assert.match(result.requestBody.instructions,/interpretation_deferred/);
  assert.match(result.requestBody.instructions,/직접 도움 요청이나 폭력 서술의 확인 필요성을 낮추지 않습니다/);
  assert.equal(result.saved.p_result._analysis_version,result.result.meta.analysisVersion);
  if(type==='class')assert.equal(input.responses[0].received_relationships.average,5);
  else assert.equal(input.selected_month_students[0].received_average,5);
});
test('과거 캐시는 새 버전으로 위장하지 않고 유료 호출 없이 반환한다',async()=>{
  const result=await harness('relationship',{cached:{id:'old',model:'old-model',result_json:{insights:[]}}});
  assert.equal(result.result.meta.analysisVersion,'이전 저장 형식');assert.equal(result.result.meta.upgradeRecommended,true);assert.equal(result.requestBody,undefined);
});
test('현재 버전 캐시는 저장된 버전을 유지하고 다시 호출하지 않는다',async()=>{
  const result=await harness('class',{cached:{id:'current',model:'gpt-5.6-terra',result_json:{_analysis_version:'2026.09.09-student-support-v18'}}});
  assert.equal(result.result.meta.upgradeRecommended,false);assert.equal(result.requestBody,undefined);
});
test('인증 실패 시 응답 데이터나 OpenAI를 호출하지 않는다',async()=>{
  const result=await harness('class',{authorized:false});assert.equal(result.status,401);assert.equal(result.calls.length,1);assert.equal(result.saved,undefined);
});
