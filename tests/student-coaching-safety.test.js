const test=require('node:test'),assert=require('node:assert/strict');
const sources=[{id:'E1',month:'2026-09',field:'helpNow',inputKind:'선택형',value:'바로 도와주세요.'}];
const safe=()=>({summary:{text:'교사가 지금 비공개로 안전을 확인합니다.',refs:['E1']},actions:[{title:'교사가 지금 안전을 확인하기',steps:['교사는 지금 비공개로 안전과 필요한 보호를 확인합니다.'],refs:['E1']}],check_after:'지금 안전 확인: 현재 안전과 필요한 도움을 확인합니다.\n보호 후 다시 확인: 보호가 이루어진 뒤 안전을 다시 확인합니다.'});
test('긴급 선택의 저장형·표시형·마침표를 인식하며 서술 문구로 추정하지 않는다',async()=>{
 const {urgentEvidence}=await import('../supabase/functions/student-coaching/safety-validation.mjs');
 for(const value of ['즉시','바로 도와주세요','바로 도와주세요.'])assert.equal(urgentEvidence([{...sources[0],value}]).length,1);
 for(const value of ['지금은 괜찮아요.','이번 주','즉시라는 단어를 적었어요'])assert.equal(urgentEvidence([{...sources[0],value}]).length,0);
 assert.equal(urgentEvidence([{...sources[0],field:'studentState.worryDetail'}]).length,0);
});
test('긴급 요청을 일반 조건부 대화나 실천 약속으로 대체할 수 없다',async()=>{
 const {validateSafetyPriority:check}=await import('../supabase/functions/student-coaching/safety-validation.mjs');
 assert.doesNotThrow(()=>check(safe(),sources));
 for(const part of ['summary','action','closing','refs']){
  const card=safe();
  if(part==='summary')card.summary.text='요즘 경험을 들어봅니다.';
  if(part==='action')card.actions[0].title='학생이 도움을 요청하면';
  if(part==='closing')card.check_after='선택할 때: 해 보고 싶은 방법이 있니?';
  if(part==='refs')card.actions[0].refs=['E2'];
  assert.throws(()=>check(card,sources),/안전 우선/);
 }
});
test('일반 응답은 안전용 문구를 강제로 요구하지 않는다',async()=>{
 const {validateSafetyPriority:check}=await import('../supabase/functions/student-coaching/safety-validation.mjs');
 assert.doesNotThrow(()=>check({},[{...sources[0],value:'지금은 괜찮아요.'}]));
});
test('검증 실패는 원문 대신 고정된 점검 코드로 구분한다',async()=>{
 const {coachingValidationError:failure}=await import('../supabase/functions/student-coaching/api-errors.mjs');
 for(const [message,code] of [['선택형 응답을 학생이 쓴 문장으로 표현할 수 없습니다.','C-MODALITY'],['코칭 문장의 점수가 일치하지 않습니다.','C-SCORE'],['코칭 문장의 문항과 연결된 근거가 일치하지 않습니다.','C-QUESTION'],['월의 근거가 빠져 있습니다.','C-MONTH'],['코칭 근거를 검증하지 못했습니다.','C-REFERENCE'],['코칭 표현을 검증하지 못했습니다.','C-TEXT'],['코칭 형식이 올바르지 않습니다.','C-FORMAT'],['긴급 도움 요청의 안전 우선 안내를 검증하지 못했습니다.','C-SAFETY'],['PRIVATE_STUDENT_RAW_TEXT','C-OUTPUT']]){
  const result=failure(new Error(message));assert.ok(result.message.endsWith(code));assert.doesNotMatch(result.message,/PRIVATE_STUDENT_RAW_TEXT/);
 }
});
