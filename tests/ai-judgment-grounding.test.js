const test=require('node:test'),assert=require('node:assert/strict');
const row=(n,p)=>({id:`r${n}`,student_number:n,survey_month:'2026-09-01',payload_json:p});
const priority=refs=>({priority_students:[{student:'학생-3',priority:'즉시 확인',source_refs:refs,observation_points:[{context:'수업',behavior:'말 끼어듦'}],coaching_questions:['왜 친구를 때렸니?']}],class_patterns:[]});
test('이번 주 요청을 즉시 요청으로 승격하지 않고 근거 없는 행동 제안을 제거한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const result=groundClassAnalysis(priority(['r3|helpNow','r3|studentState.worryDetail']),[row(3,{helpNow:'이번 주',studentState:{worryDetail:'친구'}})],'2026-09');
 assert.equal(result.priority_students[0].priority,'지속 관찰');
 assert.doesNotMatch(JSON.stringify(result),/말 끼어듦|왜 친구를 때렸니/);
});
test('실제 즉시 선택과 관계 안전 문항은 확인 우선순위를 유지한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 for(const [field,payload] of [['helpNow',{helpNow:'즉시'}],['unresolved.detail',{unresolved:{detail:'친구가 밀쳐서 아팠다'}}]]){
  const result=groundClassAnalysis(priority([`r3|${field}`]),[row(3,payload)],'2026-09');
  assert.equal(result.priority_students[0].priority,'즉시 확인');
  assert.doesNotMatch(JSON.stringify(result),/왜 친구를 때렸니/);
 }
});
test('실제 다른 문항에 어려움이 있어도 긍정 문항만 연결한 판단은 거부한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 for(const field of ['peerObservations.growth.detail','peerObservations.kind.detail','studentState.teacherWish']){
  assert.throws(()=>groundClassAnalysis(priority([`r3|${field}`]),[row(3,{peerObservations:{growth:{detail:'친구가 노력함'},kind:{detail:'친절함'}},studentState:{teacherWish:'칭찬'},unresolved:{detail:'밀쳐서 아팠다'}})],'2026-09'),/뒷받침/);
 }
});
test('없음·불명확·괜찮음은 어려움과 학급 주제 인원에서 제외한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=[row(3,{studentState:{worryDetail:'공부'}}),row(4,{studentState:{worryDetail:'없음'}}),row(5,{studentState:{worryDetail:'모르겠어요'}})];
 const result=groundClassAnalysis({class_patterns:[{pattern:'8명 경청 문제',teacher_check:'말 끼어듦 확인',source_refs:rows.map(r=>`${r.id}|studentState.worryDetail`)}]},rows,'2026-09');
 assert.match(result.class_patterns[0].pattern,/1명/);
 assert.doesNotMatch(JSON.stringify(result),/말 끼어듦|경청 문제|없음|모르겠어요/);
 assert.match(result.class_patterns[0].teacher_check,/고민/);
 assert.throws(()=>groundClassAnalysis(priority(['r3|helpNow']),[row(3,{helpNow:'괜찮음'})],'2026-09'),/뒷받침/);
});
test('현재 버전 결과 재검증도 같은 내용이며 구버전과 버전이 다르다',async()=>{
 const {groundClassAnalysis,GROUNDING_VERSION}=await import('../supabase/functions/analyze-class/grounding.mjs');
 assert.notEqual(GROUNDING_VERSION,'2026.10.30-survey-grounding-v1');
 const rows=[row(3,{helpNow:'이번 주'})],fresh=groundClassAnalysis(priority(['r3|helpNow']),rows,'2026-09');
 assert.deepEqual(groundClassAnalysis(fresh,rows,'2026-09'),fresh);
});
