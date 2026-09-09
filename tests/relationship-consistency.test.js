const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../supabase/functions/analyze-class/relationship-data.js'),core=require('../analysis-core.js'),evidence=require('../relationship-evidence.js');
const students=[1,2,3].map(number=>({number,name:`가상${number}`}));
test('서버 ES 모듈과 브라우저용 전역 경로에서도 같은 정규화 모듈이 초기화된다',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),context={};
  vm.runInNewContext(fs.readFileSync('supabase/functions/analyze-class/relationship-data.js','utf8'),context);
  assert.equal(typeof context.IeumRelationshipData.normalizeResponses,'function');
  assert.equal(JSON.stringify(context.IeumRelationshipData.normalizeRelationships([{targetNumber:2,score:5},{targetNumber:2,score:1}],1)),JSON.stringify(data.normalizeRelationships([{targetNumber:2,score:5},{targetNumber:2,score:1}],1)));
});
const row=(number,month,relationships,extra={})=>({student_number:number,survey_month:`${month}-01`,submitted_at:`${month}-10T00:00:00Z`,payload_json:{relationships},...extra});
test('중복 점수는 지도·근거·AI 입력 모두 마지막 유효 값 한 건으로 처리한다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:2,score:5},{targetNumber:2,score:1}])];
  const normalized=data.normalizeResponses(rows,students),map=core.cumulativeScores(rows,students),table=evidence.build(rows,students,core),ai=data.aiEvidence(rows,students);
  assert.equal(map.scores.get('1:2'),1);assert.equal(table.pairs[0].abAverage,1);assert.equal(normalized[0].payload_json.relationships.length,1);assert.equal(ai.pairs[0].forward_response_count,1);
});
test('잘못된 점수·자기 자신·명단 밖 대상과 응답자를 모든 경로에서 제외한다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:1,score:5},{targetNumber:9,score:5},{targetNumber:2,score:6},{targetNumber:2,score:true},{targetNumber:3,score:4}]),row(9,'2026-06',[{targetNumber:2,score:5}])];
  const map=core.cumulativeScores(rows,students),table=evidence.build(rows,students,core);
  assert.deepEqual([...map.scores],[['1:3',4]]);assert.equal(table.byStudent.get(2).incomingResponses,0);assert.equal(map.relationResponders.size,1);
});
test('정규화는 원본을 변경하지 않고 두 번 적용해도 같다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:2,score:'4'},{targetNumber:2,score:NaN}])],before=JSON.stringify(rows),once=data.normalizeResponses(rows,students);
  assert.equal(JSON.stringify(rows),before);assert.deepEqual(data.normalizeResponses(once,students),once);assert.equal(once[0].payload_json.relationships[0].score,4);
});
test('최신 빈 응답은 과거 응답으로 채우지 않고 삭제·제외 응답은 배제한다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:2,score:5}]),row(1,'2026-06',[],{submitted_at:'2026-06-11T00:00:00Z'}),row(2,'2026-06',[{targetNumber:1,score:5}],{deleted_at:'2026-06-12'}),row(3,'2026-06',[{targetNumber:1,score:5}],{analysis_excluded:true})];
  assert.equal(core.cumulativeScores(rows,students).scores.size,0);assert.equal(data.aiEvidence(rows,students).pairs.length,0);
});
test('타임스탬프가 같을 때 ID 기준 선택이 입력 순서에 영향을 받지 않는다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:2,score:5}],{id:'a'}),row(1,'2026-06',[{targetNumber:2,score:1}],{id:'b'})];
  assert.deepEqual(data.normalizeResponses(rows,students),data.normalizeResponses([...rows].reverse(),students));
});
test('AI 관측 근거는 실제 이름·원문 없이 관측 부족과 반복을 전달한다',()=>{
  const rows=[row(1,'2026-06',[{targetNumber:2,score:5}]),row(2,'2026-07',[{targetNumber:1,score:5}])],ai=data.aiEvidence(rows,students);
  assert.equal(ai.pairs[0].same_month_bidirectional_count,0);assert.equal(ai.pairs[0].mutual_positive_month_count,0);assert.ok(ai.students.every(student=>student.interpretation_deferred));assert.doesNotMatch(JSON.stringify(ai),/가상/);
});
