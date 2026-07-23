const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('analysis-dashboard.css','utf8');
const prd=fs.readFileSync('PRD_v1.2.md','utf8');

test('관계 지도는 월 선택 첫 항목에서 여러 달을 함께 볼 수 있다',()=>{
  assert.match(html,/data-relation-tab="actual"[^>]*>월별 관계 지도<\/button>/);
  assert.match(app,/var selectedRelationshipMonth='',relationshipMapMode='monthly'/);
  assert.match(app,/function relationshipMapState\(\)/);
  assert.match(html,/id="relationshipAnalysisMonth"/);
  assert.match(html,/relation-analysis-toolbar/);
  assert.match(app,/<option value="all"[^>]*>여러 달 함께 보기<\/option>/);
  assert.doesNotMatch(html,/data-relationship-map-toggle|보기 범위 늘리기/);
});

test('관계 분석 월 선택은 여러 달 보기 다음에 최신 월부터 표시한다',()=>{
  assert.match(app,/displayMonths=\[\.\.\.months\]\.reverse\(\)/);
  assert.match(app,/selector\.innerHTML=rangeOption\+displayMonths\.map/);
  assert.match(app,/selectedRelationshipMonth=months\.at\(-1\)/);
});

test('여러 달 항목은 누적 보기로 전환하고 특정 달은 월별 보기로 돌아간다',()=>{
  assert.match(html,/relation-view-tabs[\s\S]*relationshipAnalysisMonth/);
  assert.match(app,/event\.target\.id==='relationshipAnalysisMonth'/);
  assert.match(app,/event\.target\.value==='all'\)relationshipMapMode='cumulative'/);
  assert.match(app,/selectedRelationshipMonth=event\.target\.value;relationshipMapMode='monthly'/);
  assert.doesNotMatch(app,/data-relationship-map-toggle|relationship-range-toggle|relationship-map-toolbar/);
});

test('AI 관계 코칭에서는 여러 달 항목을 숨기고 선택한 월을 유지한다',()=>{
  assert.match(app,/aiSelected=\$\('#relationTabs \[data-relation-tab="ai"\]'\)\?\.classList\.contains\('active'\)/);
  assert.match(app,/const rangeOption=aiSelected\?'':`<option value="all"/);
  assert.match(app,/selector\.value=aiSelected\?selectedRelationshipMonth/);
  assert.match(app,/setRelationshipTab\(tab\)[\s\S]*updateRelationshipMonthSelector\(\)/);
});

test('AI 관계 코칭은 상단 월 선택을 지도와 함께 사용한다',()=>{
  assert.match(html,/id="relationshipAnalysisMonth"/);
  assert.match(app,/function relationshipAnalysisMonth\(\).*selectedRelationshipMonth/);
  assert.doesNotMatch(app,/relationshipAiMonthSelect|relationshipMonthSelect/);
  assert.match(app,/relationshipAnalysisMonth[\s\S]*renderRelationshipActions\(\)/);
});

test('관계 지도 상태는 앱의 첫 렌더에서도 초기화 순서 오류가 나지 않는다',()=>{
  assert.ok(app.indexOf("var selectedRelationshipMonth='',relationshipMapMode='monthly'")>app.indexOf('renderRelationshipsV2();renderRelationshipActions()'));
  assert.doesNotMatch(app,/let selectedRelationshipMonth='',relationshipMapMode='monthly'/);
});

test('월별 지도는 선택 월의 최신 응답과 80% 안전장치를 사용한다',()=>{
  assert.match(app,/allResponses\.filter\(item=>monthOf\(item\)===selectedRelationshipMonth\)/);
  assert.match(app,/buildCumulativeRelationshipAnalysis\(source\)/);
  assert.match(app,/선택 범위의 설문 참여율과 친구 관계 응답률이 각각 80% 이상/);
  assert.match(app,/결석·미제출은 0점으로 계산하지 않습니다/);
});

test('이전 달 비교는 단절로 단정하지 않는 세 가지 상태를 표시한다',()=>{
  assert.match(app,/새로 확인된 상호 연결/);
  assert.match(app,/이어서 확인된 상호 연결/);
  assert.match(app,/이번 달 응답에서 확인되지 않음/);
  assert.match(app,/관계가 끊어졌다는 뜻은 아닙니다/);
  assert.match(css,/\.relation-change-summary/);
  assert.match(prd,/연결이 확인되지 않은 것을 관계 단절로 표현하지 않는다/);
});

test('지도 아래 안내는 월별 보기와 누적 관계 보기 범위를 정확히 구분한다',()=>{
  assert.match(app,/relationshipMapMode==='monthly'\?'1100×640 기준의 반응형 캔버스입니다\. 선택한 달의 학생별 최신 응답만 사용하며/);
  assert.match(app,/전체 월의 실제 응답만 평균하며 결석·미제출 월은 평균에서 제외합니다/);
});
