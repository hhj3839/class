const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../supabase/functions/analyze-class/relationship-data.js'),{compare}=require('../relationship-changes.js');
const roster=[1,2,3].map(number=>({number,studentId:`s${number}`,name:`비공개${number}`}));
const row=(number,month,score=5)=>({id:`r${number}-${month}`,student_id:`s${number}`,student_number:number,survey_month:`${month}-01`,payload_json:{relationships:roster.filter(s=>s.number!==number).map(s=>({targetNumber:s.number,score})),studentState:{worryDetail:'PRIVATE_STORY'}}});
const context=responses=>({student:roster[0],roster,responses});
test('코칭 관계 근거는 동일 학생의 직전 달 양방향 비교와 출처만 포함한다',async()=>{
 const {relationshipContext}=await import('../supabase/functions/student-coaching/relationship-context.mjs');
 const result=relationshipContext(context(['2026-06','2026-07'].flatMap(month=>roster.map(s=>row(s.number,month,month==='2026-06'?2:5)))),data,compare);
 assert.equal(result.length,2);assert.match(result[1].value,/확인된 2명만 비교: 새 기준 충족 2명/);
 assert.ok(result[1].responseIds.includes('r1-2026-06'));assert.doesNotMatch(JSON.stringify(result),/비공개|PRIVATE_STORY/);
});
test('미응답 달을 건너뛰거나 낮은 점수로 채우지 않는다',async()=>{
 const {relationshipContext}=await import('../supabase/functions/student-coaching/relationship-context.mjs');
 const result=relationshipContext(context([row(1,'2026-05'),row(2,'2026-05'),row(1,'2026-07'),row(2,'2026-07')]),data,compare);
 assert.equal(result.length,1);assert.match(result[0].value,/변화 해석 보류/);assert.doesNotMatch(result[0].value,/새 기준 충족/);
});
test('학생 번호가 재사용되거나 전출 기간이면 관계 근거를 확대하지 않는다',async()=>{
 const {relationshipContext}=await import('../supabase/functions/student-coaching/relationship-context.mjs');
 const c=context([row(1,'2026-07'),{...row(2,'2026-07'),student_id:'old-person'}]);
 assert.match(relationshipContext(c,data,compare)[0].value,/양방향 응답 0명/);
 c.student={...c.student,transferredOn:'2026-07-20'};assert.deepEqual(relationshipContext(c,data,compare),[]);
});
test('새 관계 근거는 기존 E번호 뒤에 추가되어 저장 카드의 근거를 바꾸지 않는다',async()=>{
 const {buildEvidence,instructions}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const c=context([row(1,'2026-07'),row(2,'2026-07')]);
 const old=buildEvidence(c,data),next=buildEvidence(c,data,compare);
 assert.deepEqual(next.sources.slice(0,old.sources.length),old.sources);
 assert.ok(next.sources.some(s=>s.field==='relationship_context'));
 for(const text of ['친구를 늘리거나','비교 보류이면 변화 주장을 하지','고민·바람·도움 요청을 먼저','숫자가 낮거나','바라는 변화가 없으면 마쳐도'])assert.ok(instructions.includes(text));
});
