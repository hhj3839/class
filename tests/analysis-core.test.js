const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../analysis-core.js');

const response=(month,student,submitted,relationships,extra={})=>({survey_month:`${month}-01`,student_number:student,submitted_at:submitted,payload_json:{relationships},...extra});

test('결석·미제출 월은 0점이 아니라 실제 응답만 평균한다',()=>{const rows=[response('2026-06',1,'2026-06-10T00:00:00Z',[{targetNumber:2,score:5}]),response('2026-07',1,'2026-07-10T00:00:00Z',[{targetNumber:2,score:3}]),response('2026-07',2,'2026-07-10T00:00:00Z',[{targetNumber:1,score:2}])];const result=core.cumulativeScores(rows);assert.equal(result.scores.get('1:2'),4);assert.equal(result.scores.get('2:1'),2);assert.equal(result.samples.get('2:1').length,1)});
test('같은 달 중복 제출은 최신 응답만 사용한다',()=>{const rows=[response('2026-07',1,'2026-07-01T00:00:00Z',[{targetNumber:2,score:1}]),response('2026-07',1,'2026-07-15T00:00:00Z',[{targetNumber:2,score:5}])];assert.equal(core.cumulativeScores(rows).scores.get('1:2'),5)});
test('분석 제외 응답은 계산하지 않는다',()=>{const rows=[response('2026-06',1,'2026-06-01T00:00:00Z',[{targetNumber:2,score:1}],{analysis_excluded:true}),response('2026-07',1,'2026-07-01T00:00:00Z',[{targetNumber:2,score:5}])];assert.equal(core.cumulativeScores(rows).scores.get('1:2'),5)});
test('관계망 안전장치는 80% 이상에서만 열린다',()=>{assert.equal(core.isRelationshipReady(100,80,80),true);assert.equal(core.isRelationshipReady(100,79,100),false);assert.equal(core.isRelationshipReady(100,50,50),false)});
test('동일 평균이라도 양극화 분포를 구분한다',()=>{const polarized=core.polarization([1,1,5,5]),stable=core.polarization([3,3,3,3]);assert.equal(polarized.average,stable.average);assert.equal(polarized.candidate,true);assert.equal(stable.candidate,false)});
test('5↔1 비대칭 관계를 탐지한다',()=>{const scores=new Map([['1:2',5],['2:1',1],['1:3',4],['3:1',4]]);const pairs=core.asymmetricPairs(scores,[1,2,3]);assert.deepEqual(pairs,[{a:1,b:2,ab:5,ba:1}])});
