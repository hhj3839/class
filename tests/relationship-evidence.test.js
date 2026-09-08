const test=require('node:test'),assert=require('node:assert/strict'),evidence=require('../relationship-evidence.js'),core=require('../analysis-core.js');
const students=[1,2,3].map(number=>({number,name:`가상${number}`}));
const response=(student,month,relationships,extra={})=>({student_number:student,survey_month:`${month}-01`,submitted_at:`${month}-10T00:00:00Z`,payload_json:{relationships},...extra});
const score=(targetNumber,score)=>({targetNumber,score});
test('방향별 다른 달 응답은 같은 달 상호 관측으로 합치지 않는다',()=>{
  const result=evidence.build([response(1,'2026-06',[score(2,5)]),response(2,'2026-07',[score(1,5)])],students,core),pair=result.pairs[0];
  assert.equal(pair.abCount,1);assert.equal(pair.baCount,1);assert.equal(pair.months.length,2);assert.equal(pair.commonMonths.length,0);assert.equal(pair.positiveMonths.length,0);
  assert.match(evidence.description(result.byStudent.get(1),0),/해석을 보류/);
});
test('월별 최신 응답만 사용하고 제외 응답과 빈 응답은 점수로 보충하지 않는다',()=>{
  const result=evidence.build([response(1,'2026-06',[score(2,1)]),response(1,'2026-06',[score(2,5)],{submitted_at:'2026-06-11T00:00:00Z'}),response(2,'2026-06',[score(1,4)]),response(2,'2026-07',[score(1,1)],{analysis_excluded:true}),response(3,'2026-06',[])],students,core);
  assert.equal(result.pairs[0].abAverage,5);assert.equal(result.pairs[0].baCount,1);assert.deepEqual(result.pairs[0].positiveMonths,['2026-06']);assert.equal(result.pairs[1].abAverage,null);
});
test('반복 관측과 받은 응답자 수를 구분한다',()=>{
  const rows=['2026-06','2026-07'].flatMap(month=>[response(1,month,[score(2,5),score(3,2)]),response(2,month,[score(1,4)]),response(3,month,[score(1,3)])]);
  const result=evidence.build(rows,students,core),summary=result.byStudent.get(1);
  assert.equal(summary.incomingResponses,4);assert.equal(summary.incomingPeers,2);assert.equal(summary.bothPeers,2);assert.equal(summary.months.length,2);assert.match(evidence.description(summary,1),/고립을 뜻하지 않습니다/);
});
test('자기 평가, 명단 밖 학생, 잘못된 점수, 중복 항목을 관측 수로 부풀리지 않는다',()=>{
  const result=evidence.build([response(1,'2026-06',[score(1,5),score(9,5),score(2,5),score(2,4),score(3,0),score(3,6)])],students,core);
  assert.equal(result.pairs[0].abCount,1);assert.equal(result.pairs[0].abAverage,4);assert.equal(result.pairs[1].abCount,0);
});
test('연쇄 연결을 완전한 집단으로 표시하지 않는다',()=>{
  const [group]=evidence.groups({groups:[[1,2,3]],mutual:[{a:1,b:2,strength:5},{a:2,b:3,strength:5}]});
  assert.equal(group.links,2);assert.equal(group.possible,3);assert.equal(group.density,2/3);
});
test('빈 명단과 한 명 학급에서도 자료 부족으로 표시한다',()=>{
  assert.equal(evidence.build([],[],core).pairs.length,0);assert.match(evidence.description(evidence.build([],students.slice(0,1),core).byStudent.get(1),0),/자료가 없습니다/);
});
