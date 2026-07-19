const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('설문 관리는 현황과 응답 정정 두 탭으로 분리된다',()=>{
  const html=read('index.html');
  assert.match(html,/data-survey-admin-tab="overview"/);
  assert.match(html,/data-survey-admin-tab="correction"/);
  assert.match(html,/id="responseCorrectionPanel"[^>]*hidden/);
});

test('분석 대시보드는 이번 주 필터 없이 두 확인 단계만 표시한다',()=>{
  const html=read('index.html');
  const filters=html.match(/<div class="filter-tabs">([\s\S]*?)<\/div>/)?.[1]||'';
  assert.doesNotMatch(filters,/data-filter="week"|이번 주/);
  assert.match(filters,/data-filter="urgent"/);
  assert.match(filters,/data-filter="watch"/);
});

test('관계 분석 결과와 관찰 포인트에서 비대칭·이번 주 단계를 제거한다',()=>{
  const app=read('app.js');
  const relationView=app.slice(app.indexOf('function renderRelationshipsV2'),app.indexOf('function setRelationshipTab'));
  const actions=app.slice(app.indexOf('function renderRelationshipActions'),app.indexOf('// 관계 분석은'));
  assert.doesNotMatch(relationView,/asymmetric|비대칭/);
  assert.doesNotMatch(actions,/비대칭|이번 주|지속 관찰/);
  assert.match(actions,/우선 확인/);
});

test('누적 관계망은 고정 캔버스와 학생 강조 도구를 제공한다',()=>{
  const app=read('app.js'),css=read('analysis-dashboard.css');
  assert.match(app,/width=900,height=520/);
  assert.match(app,/id="relationStudentFocus"/);
  assert.match(app,/data-relation-edge/);
  assert.match(app,/<rect x="-46" y="-21" width="92" height="42"/);
  assert.match(css,/\.network-fixed-frame/);
  assert.match(css,/\.relation-summary-grid/);
});
