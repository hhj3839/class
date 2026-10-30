const test=require('node:test'),assert=require('node:assert/strict');
const row=(n,value,extra={})=>({id:'p'+n,student_number:n,survey_month:'2026-09-01',submitted_at:'2026-09-01',payload_json:{studentState:{parentWish:value,worryDetail:'학습 도움 요청'}},...extra});
test('요청별 지원 방향은 해당 원문에만 연결하고 원인·가정 상황을 단정하지 않는다',async()=>{
 const {parentSupportPattern:pattern}=await import('../supabase/functions/analyze-class/parent-support.mjs');
 const source=(n,value)=>({student:'학생-'+n,field:'studentState.parentWish',value,ref:'p'+n+'|studentState.parentWish'});
 const result=pattern([source(1,'공부를 알려주세요'),source(2,'학원 끝어주세요'),source(3,'화를 적게 내주세요')]);
 assert.deepEqual(result.support_directions.map(d=>d.title),['학습 도움 요청','학원 관련 요청','화 표현 관련 요청']);
 result.support_directions.forEach((d,i)=>assert.deepEqual(d.source_refs,['p'+(i+1)+'|studentState.parentWish']));
 assert.match(result.support_directions[1].check,/부담이나 중단 필요성을 단정하지 않습니다/);
 assert.match(result.support_directions[2].check,/가정 상황을 단정하지 않습니다/);
 assert.match(result.support_directions[2].support,/개인 응답은 공개하지 않습니다/);
 assert.equal(pattern([source(1,'제 말을 들어주세요')]).support_directions.length,0);
 assert.equal(pattern([source(1,'공부가 재미있고 학원이 좋아요. 사랑해요')]),null);
});
test('부모 지원 요청과 애정·물품 희망·도움 불필요 구분',async()=>{
 const {parentSupportCandidate:check}=await import('../supabase/functions/analyze-class/parent-support.mjs');
 for(const value of ['공부를 알려주세요','학원 끝어주세요','화를 적게 내주세요','제 말을 들어주세요','함께 시간을 보내주세요','때리지 마세요'])assert.equal(check(value),true,value);
 for(const value of ['','없음','사랑해요','건강하세요','장난감 사주세요','도움이 필요 없어요','학원이 재미있어요'])assert.equal(check(value),false,value);
});
test('요약 3명 유지, 학급 흐름 첫 항목에 모든 부모 지원 근거 연결',async()=>{
 const {groundClassAnalysis:ground}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=[row(1,'공부를 알려주세요'),row(2,'화를 적게 내주세요'),row(3,'학원을 줄여주세요'),row(4,'사랑해요')];
 const analysis={priority_students:[1,2,3].map(n=>({student:'학생-'+n,source_refs:['p'+n+'|studentState.worryDetail']})),class_patterns:[1,2,3].map(n=>({source_refs:['p'+n+'|studentState.worryDetail']}))};
 const result=ground(analysis,rows,'2026-09');
 assert.deepEqual(result.priority_students.map(s=>s.student),['학생-1','학생-2','학생-3']);
 assert.equal(result.class_patterns.length,3);
 assert.match(result.class_patterns[0].pattern,/지원 요청 후보 3명/);
 assert.deepEqual(result.class_patterns[0].source_refs,[1,2,3].map(n=>'p'+n+'|studentState.parentWish'));
 assert.match(result.class_patterns[0].teacher_check,/학급/);
 assert.deepEqual(ground(result,rows,'2026-09'),result);
 assert.equal(result.additional_review.missing,0);
});
test('캐시 재조회도 최신 유효 응답만 반영하고 이전 보완 항목 제거',async()=>{
 const {groundClassAnalysis:ground}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const old=ground({priority_students:[],class_patterns:[]},[row(1,'도와주세요')],'2026-09');
 const rows=[row(1,'도와주세요'),row(1,'사랑해요',{id:'new',submitted_at:'2026-09-02'}),row(2,'도와주세요',{analysis_excluded:true}),row(3,'도와주세요',{deleted_at:'now'}),row(4,'도와주세요',{survey_month:'2026-08-01'})];
 assert.equal(ground(old,rows,'2026-09').class_patterns.length,0);
});
