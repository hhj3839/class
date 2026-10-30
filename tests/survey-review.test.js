const test=require('node:test'),assert=require('node:assert/strict');
const review=require('../survey-review.js');
const row=(n,p,id='r'+n)=>({id,student_number:n,survey_month:'2026-09-01',submitted_at:'2026-09-01',payload_json:p});
test('요약 3명 제한과 무관하게 부모 요청·안전·짧은 응답을 원문으로 보완한다',()=>{
 const rows=[row(1,{helpNow:'이번 주'}),row(2,{peerObservations:{hurt:{detail:'친구를 밀치는 것을 봄'}}}),row(3,{studentState:{worryDetail:'공부'}}),row(4,{studentState:{parentWish:'공부를 알려주세요'}}),row(5,{peerObservations:{needsHelp:{detail:'친구'}}})];
 const result=review.coverage(rows,'2026-09',{priority_students:rows.slice(0,3).map(r=>({source_refs:[review.collect([r],'2026-09')[0].ref]})),class_patterns:[{source_refs:['r4|studentState.parentWish']}]});
 assert.equal(result.checked,5);assert.equal(result.covered,3);assert.equal(result.additional.length,2);assert.equal(result.missing,0);
 assert.deepEqual(result.additional.map(x=>x.number),[4,5]);
});
test('서술 위치에 상관없이 보존하고 없음·빈칸·괜찮음은 추가하지 않는다',()=>{
 const result=review.collect([row(1,{helpNow:'괜찮음',studentState:{worryDetail:'없음',parentWish:'',teacherWish:'이야기를 들어주세요'},selfRatings:{study:{reason:'학교에 가기 무서워요'}},peerObservations:{kind:{detail:'모르겠습니다'},hurt:{detail:'없음도움필요없음'},growth:{detail:'딱히 없음'}}})],'2026-09');
 assert.deepEqual(result.map(x=>x.field),['studentState.teacherWish','selfRatings.study.reason','peerObservations.kind.detail']);
});
test('월·삭제·분석제외·중복·원문 HTML을 정확히 처리한다',()=>{
 const rows=[row(1,{helpNow:'즉시'}),{...row(1,{helpNow:'괜찮음'},'new'),submitted_at:'2026-09-02'},{...row(2,{helpNow:'즉시'}),analysis_excluded:true},{...row(3,{helpNow:'즉시'}),deleted_at:'now'},{...row(4,{helpNow:'즉시'}),survey_month:'2026-08-01'},row(5,{studentState:{parentWish:'<script>원문</script>'}})];
 assert.deepEqual(review.collect(rows,'2026-09').map(x=>x.number),[5]);
 assert.equal(review.collect(rows,'2026-09')[0].value,'<script>원문</script>');
});
test('기존 저장 결과도 추가 확인 목록을 신뢰하지 않고 원문에서 다시 생성한다',async()=>{
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const result=groundClassAnalysis({priority_students:[],class_patterns:[],additional_review:{additional:[]}},[row(4,{studentState:{parentWish:'화를 조금 줄여주세요'}})],'2026-09');
 assert.equal(result.additional_review.additional[0].field,'studentState.parentWish');
 assert.equal(result.additional_review.missing,0);
});
test('AI 입력과 근거 검증에 부모님께 바라는 점 포함',async()=>{
 const fs=require('node:fs');const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
 assert.match(edge,/parentWish:text\(state.parentWish\)/);
 assert.match(edge,/\['studentState.parentWish',state.parentWish\]/);
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const result=groundClassAnalysis({priority_students:[{student:'학생-4',source_refs:['r4|studentState.parentWish']}],class_patterns:[]},[row(4,{studentState:{parentWish:'도와주세요'}})],'2026-09');
 assert.match(result.priority_students[0].attention_reason,/부모님께 바라는 점/);
 assert.throws(()=>groundClassAnalysis({priority_students:[{student:'학생-4',source_refs:['r4|studentState.parentWish']}],class_patterns:[]},[row(4,{studentState:{parentWish:'사랑해요'}})],'2026-09'),/뒷받침/);
});
