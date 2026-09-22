const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const evidence=require('../relationship-evidence.js');
const data=require('../supabase/functions/analyze-class/relationship-data.js');
const changes=require('../relationship-changes.js');
const students=[1,2].map(number=>({number,student_id:`s${number}`}));
const row=(number,month,score=5)=>({student_number:number,student_id:`s${number}`,survey_month:`${month}-01`,payload_json:{relationships:[{targetNumber:3-number,score}]}});
test('누적 평균이 높아도 관측 시기가 다르면 상호 관측으로 설명하지 않는다',()=>{
 const pair=data.buildEvidence([row(1,'2026-06'),row(2,'2026-07')],students).pairs[0];
 assert.equal(pair.abAverage,5);assert.equal(pair.baAverage,5);
 assert.match(evidence.pairDescription(pair),/서로 다른 시기/);
});
test('동일 월 양방향 관측을 분모로 높은 평가의 반복을 설명한다',()=>{
 const pair=data.buildEvidence([row(1,'2026-06'),row(2,'2026-06'),row(1,'2026-07',2),row(2,'2026-07'),row(1,'2026-08')],students).pairs[0];
 assert.equal(evidence.pairDescription(pair),'함께 응답한 2개월 중 서로 4점 이상 1개월');
 assert.match(evidence.pairDescription(data.buildEvidence([row(1,'2026-06')],students).pairs[0]),/해석 보류/);
});
test('직전 달 미응답과 비어 있는 달은 새 연결로 세지 않는다',()=>{
 for(const rows of [[row(1,'2026-07'),row(2,'2026-07')],[row(1,'2026-05'),row(2,'2026-05'),row(1,'2026-07'),row(2,'2026-07')]]){
  const result=changes.compare(rows,students,'2026-07',data);
  assert.equal(result.previousMonth,'2026-06');assert.equal(result.total.new.length,0);assert.equal(result.total.comparable,0);
 }
});
test('서버 AI는 화면의 비교 함수를 재사용하고 전체 수 차이로 새 연결을 계산하지 않는다',()=>{
 const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
 assert.match(edge,/import '\.\.\/\.\.\/\.\.\/relationship-changes\.js'/);
 assert.match(edge,/relationshipChanges\.compare\(rows\|\|\[\]/);
 assert.match(edge,/newPairs=comparison\.total\.new/);
 assert.match(edge,/comparable_changes:comparableChanges/);
 assert.doesNotMatch(edge,/months\.filter\(value=>value<month\)\.at\(-1\)/);
});
