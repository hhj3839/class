const test=require('node:test'),assert=require('node:assert/strict');
const source=(id,month,field,value='가상 응답')=>({id,month,field,value,label:field==='relationships'?'친구에게 받은 관계 평가':'학교생활 고민'});

test('반복 고민의 최신·이전 근거를 분리하고 원문을 복제하지 않는다',async()=>{
 const {comparisonContext}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const sources=[source('E1','2026-07','worry','성적'),source('E2','2026-08','worry','성적')],before=JSON.stringify(sources);
 const [group]=comparisonContext(sources);assert.deepEqual(group.latest_refs,['E2']);assert.deepEqual(group.previous,[{month:'2026-07',ref:'E1'}]);assert.equal(group.comparable,true);assert.equal(JSON.stringify(sources),before);assert.ok(!JSON.stringify(group).includes('성적'));
});
test('자기평가와 관계 점수를 고민의 변화로 혼합하지 않는다',async()=>{
 const {comparisonContext}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const groups=comparisonContext([source('E1','2026-07','selfRatings.study','3점'),source('E2','2026-08','selfRatings.study','4점'),source('E3','2026-08','worry','성적'),source('E4','2026-07','relationships')]);
 assert.equal(groups.length,3);assert.equal(groups[0].comparable,true);assert.equal(groups[1].comparable,false);assert.equal(groups[2].comparable,false);
});
test('누락된 달이나 문항을 비교 자료로 만들어내지 않는다',async()=>{
 const {comparisonContext}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const [group]=comparisonContext([source('E1','2026-06','worry'),source('E2','2026-09','worry')]);
 assert.deepEqual(group.previous,[{month:'2026-06',ref:'E1'}]);assert.equal(group.latest_month,'2026-09');assert.deepEqual(comparisonContext([]),[]);
});
test('같은 달 근거가 여러 건이어도 과거 비교로 분류하지 않는다',async()=>{
 const {comparisonContext}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const [group]=comparisonContext([source('E1','2026-09','worry'),source('E2','2026-09','worry')]);assert.equal(group.comparable,false);assert.deepEqual(group.previous,[]);
});
test('코칭 지침은 자료 부족·구체적 호소·안전 요청을 구분한다',async()=>{
 const {instructions,schema}=await import('../supabase/functions/student-coaching/coaching.mjs');
 for(const rule of ['비교 자료 부족','자기평가 점수 상승은 실제 성적·행동 향상이 아니며','해결됐다고 판단하지','1개를 기본','조건부 제안','긴 문장을 이해하기 어려워요','안전 확인을 우선'])assert.ok(instructions.includes(rule),rule);
 assert.equal(schema.properties.actions.minItems,1);assert.equal(schema.properties.actions.maxItems,2);
});
