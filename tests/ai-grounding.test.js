const test=require('node:test'),assert=require('node:assert/strict');
const row=(number,payload,id='r'+number)=>({id,student_number:number,survey_month:'2026-09-01',payload_json:payload});
const card=(refs,extra={})=>({priority_students:[{student:'학생-3',attention_reason:'즉시 도움 요청을 표시했습니다.',protective_factors:['욕을 덜 한다고 작성했습니다.'],source_refs:refs,...extra}],class_patterns:[]});
test('학급 사실 설명은 AI 표현 대신 실제 도움 요청 선택값과 원문으로 구성한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const result=groundClassAnalysis(card(['r3|helpNow']),[row(3,{helpNow:'이번 주'})],'2026-09');
 assert.match(result.priority_students[0].attention_reason,/이번 주에 이야기하고 싶어요/);
 assert.doesNotMatch(result.priority_students[0].attention_reason,/즉시/);
 assert.deepEqual(result.priority_students[0].protective_factors,[]);
});
test('다른 학생의 근거와 없는 문항은 저장 전에 거부한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 for(const ref of ['r4|helpNow','r3|missing'])assert.throws(()=>groundClassAnalysis(card([ref]),[row(4,{helpNow:'이번 주'})],'2026-09'),/근거/);
});
test('없음만으로 주의 학생을 만들지 않는다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 assert.throws(()=>groundClassAnalysis(card(['r3|studentState.worryDetail']),[row(3,{studentState:{worryDetail:'없음'}})],'2026-09'),/응답 없음/);
});
test('친구 관련 서술은 작성 학생의 성장으로 변환하지 않는다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 assert.throws(()=>groundClassAnalysis(card(['r3|peerObservations.growth.detail']),[row(3,{peerObservations:{growth:{detail:'다른 친구가 욕을 줄였다'}}})],'2026-09'),/뒷받침하는 응답 없음/);
});
test('학급 흐름 인원은 원문 작성 학생을 중복 없이 센다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const result=groundClassAnalysis({priority_students:[],class_patterns:[{pattern:'10명이 힘들어함',source_refs:['r3|helpNow','r3|studentState.worryDetail']}]},[row(3,{helpNow:'이번 주',studentState:{worryDetail:'공부'}})],'2026-09');
 assert.match(result.class_patterns[0].pattern,/1명/);assert.doesNotMatch(result.class_patterns[0].pattern,/10명/);
});
test('응답 내용 변경은 저장 결과 지문을 변경한다',async()=>{
 const {fingerprintRows}=await import('../supabase/functions/analyze-class/grounding.mjs');
 assert.notEqual(await fingerprintRows([row(3,{helpNow:'이번 주'})],'2026-09'),await fingerprintRows([row(3,{helpNow:'즉시'})],'2026-09'));
});
test('코칭의 없음 왜곡·선택값 왜곡·가짜 원문 인용을 차단한다',async()=>{
 const {validateEvidenceClaims}=await import('../supabase/functions/student-coaching/evidence-validation.mjs');
 assert.throws(()=>validateEvidenceClaims('학교생활 고민으로 친구 때문에 힘들다고 적었습니다.',['E1'],[{id:'E1',field:'studentState.worryDetail',value:'없음'}]),/없음/);
 assert.throws(()=>validateEvidenceClaims('즉시 도움 요청을 선택했습니다.',['E1'],[{id:'E1',field:'helpNow',value:'이번 주'}]),/선택값/);
 assert.throws(()=>validateEvidenceClaims('학교생활 고민에 “친구가 때렸다”라고 적었습니다.',['E1'],[{id:'E1',field:'studentState.worryDetail',value:'공부'}]),/원문/);
 assert.doesNotThrow(()=>validateEvidenceClaims('학교생활 고민에 “학생-2와 연습”이라고 적었습니다.',['E1'],[{id:'E1',field:'studentState.worryDetail',value:'가상친구와 연습',quoteValue:'학생-2와 연습'}]));
 assert.throws(()=>validateEvidenceClaims('학교생활 고민은 없음이라고 했지만 불안하다고 응답했습니다.',['E1'],[{id:'E1',field:'studentState.worryDetail',value:'없음'}]),/단정/);
});
