const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');

test('실제 관계 화면과 관찰 포인트는 누적 관계분석 이름을 명시적으로 사용한다',()=>{
  assert.match(app,/function buildCumulativeRelationshipAnalysis\(responses\)/);
  assert.match(app,/function renderRelationshipsV2\(\)[\s\S]*buildCumulativeRelationshipAnalysis\(allResponses\)/);
  assert.match(app,/function renderRelationshipActions\(\)[\s\S]*buildCumulativeRelationshipAnalysis\(allResponses\)/);
});

test('관계분석 함수 선언은 뒤에서 같은 이름으로 덮어쓰지 않는다',()=>{
  const names=[...app.matchAll(/function\s+(buildRelationshipAnalysis|buildCumulativeRelationshipAnalysis|renderRelationships|renderCumulativeRelationships)\s*\(/g)].map(match=>match[1]);
  assert.equal(new Set(names).size,names.length);
});

test('사용되지 않는 과거 월별 관계분석 구현은 번들에 남기지 않는다',()=>{
  assert.doesNotMatch(app,/function buildRelationshipAnalysis\(/);
  assert.doesNotMatch(app,/function renderRelationships\(/);
});
