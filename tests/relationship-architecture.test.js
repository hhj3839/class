const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');

test('월별 지도와 누적 AI 해석은 같은 관계분석 계산을 범위별로 사용한다',()=>{
  assert.match(app,/function buildCumulativeRelationshipAnalysis\(responses\)/);
  assert.match(app,/function relationshipMapState\(\)[\s\S]*buildCumulativeRelationshipAnalysis\(source\)/);
  assert.match(app,/function renderRelationshipActions\(\)[\s\S]*buildCumulativeRelationshipAnalysis\(allResponses\)/);
});

test('관계분석 함수 선언은 뒤에서 같은 이름으로 덮어쓰지 않는다',()=>{
  const names=[...app.matchAll(/function\s+(buildRelationshipAnalysis|buildCumulativeRelationshipAnalysis|renderRelationships|renderCumulativeRelationships)\s*\(/g)].map(match=>match[1]);
  assert.equal(new Set(names).size,names.length);
});

test('중복된 과거 관계분석 구현은 번들에 남기지 않는다',()=>{
  assert.doesNotMatch(app,/function buildRelationshipAnalysis\(/);
  assert.doesNotMatch(app,/function renderRelationships\(/);
});
