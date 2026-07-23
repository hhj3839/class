const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('analysis-dashboard.css','utf8');
const prd=fs.readFileSync('PRD_v1.2.md','utf8');

test('관계 지도는 최근 월을 기본으로 선택하고 보기 범위를 늘릴 수 있다',()=>{
  assert.match(html,/data-relation-tab="actual"[^>]*>월별 관계 지도<\/button>/);
  assert.match(app,/var selectedRelationshipMonth='',relationshipMapMode='monthly'/);
  assert.match(app,/function relationshipMapState\(\)/);
  assert.match(html,/id="relationshipAnalysisMonth"/);
  assert.match(html,/relation-analysis-toolbar/);
  assert.match(html,/data-relationship-map-toggle[^>]*>보기 범위 늘리기<\/button>[\s\S]*id="relationshipAnalysisMonth"/);
  assert.match(app,/button\.textContent=cumulative\?'선택한 달만 보기':'보기 범위 늘리기'/);
});

test('관계 지도 범위 버튼은 월 선택 바로 옆에 있고 달을 고르면 월별로 돌아간다',()=>{
  assert.match(html,/relation-view-tabs[\s\S]*data-relationship-map-toggle[\s\S]*relationshipAnalysisMonth/);
  assert.match(app,/event\.target\.id==='relationshipAnalysisMonth'/);
  assert.match(app,/selectedRelationshipMonth=event\.target\.value;relationshipMapMode='monthly';renderRelationshipsV2\(\)/);
  assert.match(app,/relationshipMapMode=relationshipMapMode==='monthly'\?'cumulative':'monthly'/);
  assert.doesNotMatch(app,/relationship-map-toolbar|월별 관계로 돌아가기|누적 관계 보기/);
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
