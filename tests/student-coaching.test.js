const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
test('안전 문항은 선택 학생의 작성 내용과 출처 표시만 AI에 전달한다',async()=>{
 const context=makeContext();context.responses[0].payload_json.peerObservations={hurt:{detail:'가상학생나가 밀치는 장면을 들었습니다.',sourceType:'전해 들음',frequency:'2~3번',ongoing:false},needsHelp:{detail:'친구에게 도움이 필요하다고 생각해요.'}};
 context.responses[1].payload_json.peerObservations={hurt:{detail:'다른 응답자의 비공개 안전 내용'}};
 const result=await harness({context,action:'generate'}),input=JSON.parse(result.aiBody.input);
 const safety=input.evidence.find(source=>source.question==='놀림·상처·폭력 관련 경험');
 assert.equal(safety.safety_context.sourceType,'전해 들음');assert.equal(safety.safety_context.frequency,'2~3번');
 assert.equal(safety.safety_context.ongoing,'계속됨을 선택하지 않음');
 assert.ok(input.evidence.some(source=>source.question==='도움이 필요하다고 생각한 친구와 까닭'));
 assert.doesNotMatch(result.aiBody.input,/가상학생나|다른 응답자의 비공개 안전 내용/);
});
test('문구 버전만 다른 카드는 안전 기준과 근거가 유효하면 원래 버전으로 무료 조회한다',async()=>{
 const context=makeContext();context.card={id:'compatible',source_hash:context.sourceHash,result_json:{...validCard(),version:'previous-wording',validationVersion:'2026.09.13-safety-evidence-v1'}};
 const result=await harness({context,action:'generate'});
 assert.equal(result.result.stale,false);assert.equal(result.result.previousGuidance,true);
 assert.equal(result.result.card.result.version,'previous-wording');assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0);
});
test('안전 근거 기준이 없는 v7 카드는 재사용하지 않고 자동 생성도 하지 않는다',async()=>{
 const context=makeContext();context.card={id:'unsafe-old',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.13-open-experience-v7'}};
 const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined);
});
test('호환 카드도 원본이 바뀌거나 근거가 깨지면 숨긴다',async()=>{
 for(const changed of ['hash','refs']){
  const context=makeContext();context.card={id:'compatible',source_hash:changed==='hash'?'older':context.sourceHash,result_json:{...validCard(),version:'previous-wording',validationVersion:'2026.09.13-safety-evidence-v1'}};
  if(changed==='refs')context.card.result_json.summary.refs=['E999'];
  const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined);
 }
});
test('고민 없음 지침은 좋은 경험과 대화 종료를 허용하고 안전 규칙을 유지한다',async()=>{
 const result=await harness({action:'generate'});
 for(const rule of ['숨은 문제나 어려움이 있다는 증거가 아닙니다','좋았던 일이 반드시 있었다고 전제하지','모든 이야기를 개선 목표로 바꾸지','학생이 지금 고른 이야기를 우선','두 줄은 강제하지 않습니다','교사의 비공개 안전 확인을 우선'])
   assert.ok(result.aiBody.instructions.includes(rule),rule);
});
test('바라는 변화가 없으면 실천 과제 없는 짧은 마무리도 저장한다',async()=>{
 const output=validCard();output.question.text='요즘 학교에서 좋았거나 기억에 남는 일이 있니?';
 output.check_after='오늘 나눈 이야기만으로 마쳐도 괜찮습니다. 나중에 학생이 바라는 변화를 말할 때 함께 살펴보세요.';
 const result=await harness({action:'generate',output});
 assert.equal(result.status,200);assert.equal(result.result.card.result.check_after,output.check_after);
 assert.equal(result.calls.filter(url=>url==='https://api.openai.com/v1/responses').length,1);
});
test('이전 근거 강화 카드는 새 대화 기준으로 위장하거나 자동 재생성하지 않는다',async()=>{
 const context=makeContext();context.card={id:'previous',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.13-evidence-fidelity-v6'}};
 const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined);
});
const data=require('../supabase/functions/analyze-class/relationship-data.js');
const studentId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
test('후속 질문 지침은 중립적 표현과 선택 전·실행 후를 구분한다',async()=>{const {instructions}=await import('../supabase/functions/student-coaching/coaching.mjs');for(const rule of ['부정적인 자기평가를 그대로 반복하거나 강화하지','원문에 없는 걱정·슬픔','본인에게 어떤 점에서 좋은지','선택할 때:','실제로 해 본 뒤:','지금 안전 확인:','보호 후 다시 확인:'])assert.ok(instructions.includes(rule),rule)});
test('이전 대화형 카드도 새 질문 기준으로 자동 변환하거나 재생성하지 않는다',async()=>{const context=makeContext();context.card={id:'v4',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.12-student-led-dialogue-v4'}};const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined)});
const makeContext=()=>({student:{studentId,number:1,name:'가상학생가'},roster:[{number:1,name:'가상학생가'},{number:2,name:'가상학생나'}],responses:[{id:'own',student_id:studentId,student_number:1,survey_month:'2026-09-01',submitted_at:'2026-09-02T00:00:00Z',payload_json:{studentState:{worryDetail:'가상학생나와 발표 연습을 하고 싶어요. test@example.invalid 010-1234-5678'},relationships:[]}},{id:'other',student_id:otherId,student_number:2,survey_month:'2026-09-01',submitted_at:'2026-09-02T00:00:00Z',payload_json:{studentState:{worryDetail:'관련 없는 다른 학생의 비공개 고민'},relationships:[{targetNumber:1,score:1},{targetNumber:1,score:5}]}}],observations:[],sourceHash:'source-v1',card:null,feedback:[],remaining:10});
const validCard=()=>({summary:{text:'설문에서 발표 연습을 하고 싶다고 적었습니다.',refs:['E1']},strengths:[],needs:[],question:{text:'요즘 발표할 때는 어떠니?',refs:['E1']},actions:[{title:'어려움을 이야기하면',steps:['학생이 말한 상황을 되짚어 맞는지 확인합니다.','조금 편했던 때에는 무엇이 달랐니?'],refs:['E1']}],check_after:'원하면 학생이 해 보고 싶은 방법을 골라도 됩니다. 해 보니 어땠고 무엇을 바꾸고 싶니?',limitations:['현재 자료만으로 원인을 확정할 수 없습니다.']});
test('이전 지도형 카드는 대화형으로 위장하지 않고 자동 생성도 하지 않는다',async()=>{const context=makeContext();context.card={id:'old',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.12-grounded-coaching-v3'}};const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0)});
test('조건부 대화는 최대 세 개이며 근거 없는 네 번째 카드는 저장하지 않는다',async()=>{const output=validCard();output.actions=Array.from({length:3},()=>({...output.actions[0]}));assert.equal((await harness({action:'generate',output})).status,200);output.actions.push({...output.actions[0]});const failed=await harness({action:'generate',output});assert.equal(failed.status,500);assert.equal(failed.saved[0].p_success,false)});
test('대화 지침은 학생의 선택과 말하지 않을 권리 및 교사의 보호 책임을 명시한다',async()=>{const result=await harness({action:'generate'});for(const rule of ['학생이 자기 경험과 바람','학생이 하지 않은 말이나 감정','말하고 싶지 않아','문제·목표·실천 약속을 만들어낼 필요가 없습니다','교사의 즉시 보호','보호를 학생의 해결 의지나 실천 약속에 조건부로 맡기지'])assert.ok(result.aiBody.instructions.includes(rule),rule)});
async function harness({action='load',authorized=true,context=makeContext(),output=validCard(),apiStatus=200,apiError=null,denied=false,key=true,force=false}={}){
  const {coachingApiError}=await import('../supabase/functions/student-coaching/api-errors.mjs');const api=await import('../supabase/functions/student-coaching/coaching.mjs'),{redactStudentNames}=await import('../supabase/functions/analyze-class/privacy.mjs');let handler,aiBody;const calls=[],saved=[];
  const fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):{};calls.push(url);
    if(url.endsWith('/auth/v1/user'))return Response.json(authorized?{id:'teacher'}:{},{status:authorized?200:401});
    if(url.endsWith('/rpc/teacher_get_student_coaching_context_auth'))return Response.json(denied?{message:'담당 학급에 대한 권한이 없습니다.'}:context,{status:denied?403:200});
    if(url.endsWith('/rpc/teacher_begin_student_coaching_auth'))return Response.json('run-id');
    if(url.endsWith('/rpc/teacher_finish_student_coaching_auth')){saved.push(body);return Response.json(true)}
    if(url==='https://api.openai.com/v1/responses'){aiBody=body;return Response.json({error:apiError,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]},{status:apiStatus})}
    throw Error('Unexpected mock request');
  };
  const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/student-coaching/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
  vm.runInNewContext(source,{...api,coachingApiError,Error,IeumRelationshipData:data,redactStudentNames,Response,Request,AbortSignal,fetch,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://mock.invalid':name==='OPENAI_API_KEY'&&!key?undefined:'test-only'},serve:fn=>handler=fn}});
  const response=await handler(new Request('https://mock.invalid/coaching',{method:'POST',headers:{Authorization:'Bearer test-only'},body:JSON.stringify({classId:'fixture',studentId,action,force})}));return{status:response.status,result:await response.json(),calls,aiBody,saved};
}
test('학생 코칭 근거는 선택 학생 자료와 계산값만 포함한다',async()=>{const api=await import('../supabase/functions/student-coaching/coaching.mjs'),result=api.buildEvidence(makeContext(),data);assert.equal(result.sources.length,2);assert.match(result.sources[1].value,/평균 5.00점/);assert.doesNotMatch(JSON.stringify(result.sources),/관련 없는/);assert.equal(result.limited,true)});
test('모든 근거 필드는 현재 요청의 ID만 허용하며 요청끼리 섞이지 않는다',async()=>{const {schemaForEvidence,schema}=await import('../supabase/functions/student-coaching/coaching.mjs');const check=(value,ids)=>{const p=value.properties;for(const refs of [p.summary.properties.refs,p.strengths.items.properties.refs,p.needs.items.properties.refs,p.question.properties.refs,p.actions.items.properties.refs]){assert.deepEqual(refs.items.enum,ids);assert.equal(refs.minItems,1);assert.equal(refs.maxItems,8)}};const first=schemaForEvidence([{id:'E1'},{id:'E2'}]);check(first,['E1','E2']);check(schemaForEvidence([{id:'E9'}]),['E9']);check(first,['E1','E2']);assert.equal(schema.properties.summary.properties.refs.items.enum,undefined);assert.throws(()=>schemaForEvidence([]),/근거/)});
test('실제 API 요청 스키마의 근거 목록은 전송한 근거 목록과 일치한다',async()=>{const result=await harness({action:'generate'});const input=JSON.parse(result.aiBody.input),ids=input.evidence.map(row=>row.id);assert.deepEqual(result.aiBody.text.format.schema.properties.summary.properties.refs.items.enum,ids);assert.deepEqual(result.aiBody.text.format.schema.properties.actions.items.properties.refs.items.enum,ids);assert.equal(result.aiBody.text.format.strict,true)});
test('가명 처리로 근거 ID가 바뀌지 않는다',async()=>{const context=makeContext();context.roster.push({number:3,name:'E1'});const result=await harness({action:'generate',context});assert.equal(JSON.parse(result.aiBody.input).evidence[0].id,'E1');assert.equal(result.status,200)});
test('다섯 번째 과거 설문은 코칭 서술 근거에서 제외한다',async()=>{const api=await import('../supabase/functions/student-coaching/coaching.mjs'),context=makeContext();context.responses=Array.from({length:5},(_,i)=>({...context.responses[0],id:`own-${i}`,survey_month:`2026-0${9-i}-01`,payload_json:{studentState:{worryDetail:`가상 고민 ${i}`}}}));const result=api.buildEvidence(context,data);assert.equal(result.sources.length,4);assert.equal(result.sources.some(row=>row.responseId==='own-4'),false);assert.equal(result.sources[0].month,'2026-09')});
test('전출월에는 관계 점수를 사용하지 않고 이후 응답은 제외한다',async()=>{const api=await import('../supabase/functions/student-coaching/coaching.mjs'),context=makeContext();context.student.transferredOn='2026-09-05';assert.equal(api.buildEvidence(context,data).sources.length,1);context.student.transferredOn='2026-08-05';assert.equal(api.buildEvidence(context,data).canGenerate,false)});
test('단순 괜찮음 응답만으로는 AI 코칭을 생성하지 않는다',async()=>{const api=await import('../supabase/functions/student-coaching/coaching.mjs'),context=makeContext();context.responses=[{...context.responses[0],payload_json:{helpNow:'괜찮아요'}}];assert.equal(api.buildEvidence(context,data).canGenerate,false)});
test('없는 근거 ID와 영어 출력은 저장 전 거부한다',async()=>{const api=await import('../supabase/functions/student-coaching/coaching.mjs'),value=validCard();value.summary.refs=['UNKNOWN'];assert.throws(()=>api.validateCard(value,[{id:'E1'}]),/근거/);value.summary.refs=['E1'];value.summary.text='The student needs support';assert.throws(()=>api.validateCard(value,[{id:'E1'}]),/표현/)});
test('조회는 API 키 없이 가능하며 AI 호출을 하지 않는다',async()=>{const result=await harness({key:false});assert.equal(result.status,200);assert.equal(result.aiBody,undefined);assert.equal(result.result.canGenerate,true)});
test('자료가 바뀐 저장 카드는 숨기고 갱신 안내만 반환한다',async()=>{const context=makeContext();context.card={id:'saved',source_hash:'old',result_json:{...validCard(),version:'old'}};const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined)});
test('현재 자료의 저장 카드는 생성 요청에서도 명시적 갱신 없이는 재사용한다',async()=>{const context=makeContext();context.card={id:'saved',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.13-safe-evidence-v8',validationVersion:'2026.09.13-safety-evidence-v1'}};const result=await harness({context,action:'generate'});assert.equal(result.status,200);assert.equal(result.result.card.id,'saved');assert.equal(result.result.cached,true);assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0)});
test('저장 카드의 근거가 깨진 경우에도 결과를 숨긴다',async()=>{const context=makeContext();context.card={id:'saved',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.13-safe-evidence-v8',validationVersion:'2026.09.13-safety-evidence-v1'}};context.card.result_json.summary.refs=['E999'];const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null)});
test('생성은 가명·연락처 가림과 store:false를 사용하고 결과를 저장한다',async()=>{const result=await harness({action:'generate'});assert.equal(result.status,200);assert.equal(result.aiBody.model,'gpt-5.6-terra');assert.equal(result.aiBody.store,false);assert.doesNotMatch(result.aiBody.input,/가상학생가|가상학생나|test@example|010-1234|관련 없는/);assert.equal(result.saved[0].p_success,true);assert.equal(result.result.card.result.version,'2026.09.13-safe-evidence-v8')});
test('잘못된 근거 결과는 실패 처리하며 저장하지 않는다',async()=>{const output=validCard();output.actions[0].refs=['E999'];const result=await harness({action:'generate',output});assert.equal(result.status,500);assert.equal(result.saved.length,1);assert.equal(result.saved[0].p_success,false)});
test('인증·학급 권한 실패는 AI 호출 전에 차단한다',async()=>{for(const options of [{authorized:false},{denied:true}]){const result=await harness({...options,action:'generate'});assert.ok([401,403].includes(result.status));assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0)}});
test('자료 없음과 API 실패를 구분하고 실패 실행을 닫는다',async()=>{const context=makeContext();context.responses=[];const empty=await harness({action:'generate',context});assert.equal(empty.status,422);assert.equal(empty.aiBody,undefined);const failure=await harness({action:'generate',apiStatus:429});assert.equal(failure.saved[0].p_success,false);assert.match(failure.result.error,/한도/)});
test('API 잔액 부족과 일시 제한을 구분하고 원문 오류를 노출하지 않는다',async()=>{for(const [code,expected] of [['insufficient_quota',/잔액/],['rate_limit_exceeded',/일시적인 요청량/],['unknown',/구분할 수 없습니다/]]){const result=await harness({action:'generate',apiStatus:429,apiError:{code,message:'sensitive-account-detail'}});assert.match(result.result.error,expected);assert.doesNotMatch(result.result.error,/sensitive-account-detail/);assert.equal(result.saved[0].p_success,false);assert.equal(result.calls.filter(url=>url.includes('api.openai.com')).length,1)}});
test('교사 관찰·면담·적용 결과는 근거와 외부 AI 요청에서 제외한다',async()=>{
  const context=makeContext();context.observations=[{id:'old',survey_month:'2026-09-01',observed_fact:'PRIVATE_OBSERVATION',interview_note:'PRIVATE_INTERVIEW'}];context.feedback=[{status:'helpful',note:'PRIVATE_FEEDBACK'}];
  const result=await harness({action:'generate',context});assert.equal(result.status,200);assert.doesNotMatch(result.aiBody.input,/PRIVATE_|prior_feedback|observation/);assert.ok(result.result.sources.every(row=>row.kind!=='observation'));
  context.responses=[];const empty=await harness({action:'generate',context});assert.equal(empty.status,422);assert.equal(empty.aiBody,undefined);
});
test('설문 전용 이전 버전은 자료 해시가 같아도 조회 시 숨기며 AI를 호출하지 않는다',async()=>{
 const context=makeContext();context.card={id:'legacy',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.09-student-coaching-v1'}};
 const result=await harness({context});assert.equal(result.result.card,null);assert.equal(result.result.stale,true);assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0);
});
test('실제 요청은 강화된 코칭 지침과 문항별 비교 근거만 전달한다',async()=>{
 const context=makeContext();context.responses.push({...context.responses[0],id:'prior',survey_month:'2026-07-01'});
 const result=await harness({action:'generate',context}),input=JSON.parse(result.aiBody.input);
 const group=input.comparison_context.find(row=>row.question==='학교생활 고민');
 assert.equal(group.latest_month,'2026-09');assert.equal(group.previous[0].month,'2026-07');assert.equal(group.comparable,true);
 assert.ok(input.evidence.some(row=>row.id===group.previous[0].ref));assert.doesNotMatch(JSON.stringify(input.comparison_context),/가상학생|test@example|010-1234/);
 for(const rule of ['성적 고민만으로','과제 시작의 어려움','조건부 제안','과제 수행·규칙 준수 여부만','양쪽 시점의 근거'])assert.ok(result.aiBody.instructions.includes(rule));
 assert.equal(result.aiBody.model,'gpt-5.6-terra');
});
test('이전 설문 전용 카드도 새 코칭 지침으로 위장하거나 자동 생성하지 않는다',async()=>{
 const context=makeContext();context.card={id:'previous',source_hash:context.sourceHash,result_json:{...validCard(),version:'2026.09.12-student-survey-only-v2'}};
 const result=await harness({context});assert.equal(result.result.stale,true);assert.equal(result.result.card,null);assert.equal(result.aiBody,undefined);assert.equal(result.saved.length,0);
});
test('비교 문장은 양쪽 월의 근거를 요구하며 연도도 검증한다',async()=>{
 const {validateCard}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const sources=[{id:'E1',month:'2026-08'},{id:'E2',month:'2026-09'}],card=validCard();
 card.summary.text='8월에는 괜찮다고 했고 9월에는 도움을 요청했습니다.';
 assert.throws(()=>validateCard(card,sources),/월의 근거/);
 card.summary.refs=['E1','E2'];assert.equal(validateCard(card,sources).summary.refs.length,2);
 card.summary.text='2025년 8월에는 도움을 요청했습니다.';assert.throws(()=>validateCard(card,sources),/월의 근거/);
 card.summary.text='8~9월에 응답했습니다.';assert.throws(()=>validateCard(card,sources),/각각 명시/);
});
test('여러 달의 비교 근거는 최대 여덟 개까지 연결한다',async()=>{
 const {validateCard}=await import('../supabase/functions/student-coaching/coaching.mjs'),card=validCard();
 const sources=Array.from({length:8},(_,i)=>({id:'E'+(i+1),month:'2026-0'+(i%4+6)}));
 card.summary={text:'6월과 7월, 8월과 9월의 응답을 확인했습니다.',refs:sources.map(s=>s.id)};
 assert.equal(validateCard(card,sources).summary.refs.length,8);
 card.summary.refs.push('E1');assert.throws(()=>validateCard(card,sources),/근거/);
});
test('도움 요청은 선택형이며 저장값과 표시값을 구분한다',async()=>{
 const context=makeContext();context.responses[0].payload_json.helpNow='괜찮음';
 const output=validCard();output.summary={text:'학생은 지금은 괜찮아요를 선택했습니다.',refs:['E1']};
 const result=await harness({context,action:'generate',output});
 const input=JSON.parse(result.aiBody.input),source=result.result.sources.find(s=>s.field==='helpNow');
 assert.equal(input.evidence[0].input_kind,'선택형');assert.equal(input.evidence[0].text,'지금은 괜찮아요');
 assert.equal(source.value,'괜찮음');assert.equal(source.displayValue,'지금은 괜찮아요');
 assert.equal(input.evidence[1].input_kind,'서술형');
});
test('선택형만 인용하면서 적었다고 표현하면 저장하지 않는다',async()=>{
 const context=makeContext();context.responses[0].payload_json.helpNow='괜찮음';
 const output=validCard();output.summary.text='9월에 괜찮음이라고 적었습니다.';
 const result=await harness({context,action:'generate',output});
 assert.equal(result.status,500);assert.match(result.result.error,/선택형/);assert.equal(result.saved[0].p_success,false);
});
test('조회는 한도 기준월과 확인 시각을 포함하며 AI를 호출하지 않는다',async()=>{
 const result=await harness();assert.match(result.result.quotaMonth,/^\d{4}-\d{2}$/);assert.ok(result.result.quotaCheckedAt>0);assert.equal(result.aiBody,undefined);
});
