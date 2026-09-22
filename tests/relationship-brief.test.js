const test=require('node:test'),assert=require('node:assert/strict');
const evidence=require('../relationship-evidence.js'),changes=require('../relationship-changes.js'),data=require('../supabase/functions/analyze-class/relationship-data.js');
const students=[1,2].map(number=>({number,student_id:`s${number}`}));
const row=(number,month,score)=>({student_id:`s${number}`,student_number:number,survey_month:`${month}-01`,payload_json:{relationships:[{targetNumber:3-number,score}]}});
const run=rows=>evidence.overview(evidence.build(rows,students),changes.compare(rows,students,'2026-07',data),1);
test('요약은 같은 달 상호 관측과 비교 가능한 관계만 표시한다',()=>{
 const brief=run([row(1,'2026-06',2),row(2,'2026-06',2),row(1,'2026-07',5),row(2,'2026-07',5)]);
 assert.match(brief.confirmed,/양방향 관측 1명.*관계 1명/);
 assert.match(brief.change,/비교 가능한 1명 · 새 기준 충족 1/);
});
test('다른 달 방향별 응답과 미응답을 관계 감소로 표시하지 않는다',()=>{
 const brief=run([row(1,'2026-06',5),row(2,'2026-07',5)]);
 assert.match(brief.confirmed,/해석을 보류/);assert.match(brief.change,/비교를 보류/);
 assert.match(brief.needs,/미확인 1명/);assert.doesNotMatch(brief.change,/기준 미충족 1/);
});
test('자료 없는 요약은 모든 응답이 있다고 표시하지 않는다',()=>{
 const brief=evidence.overview(evidence.build([],[]),null);
 assert.match(brief.needs,/자료가 없습니다/);assert.match(brief.change,/비교를 보류/);
});
