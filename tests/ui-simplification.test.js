const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const app=read('app.js');

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

test('누적 관계망은 중앙 균형 배치와 별도 범례 표를 제공한다',()=>{
  const app=read('app.js'),css=read('analysis-dashboard.css');
  assert.match(app,/id="relationStudentFocus"/);
  assert.match(app,/data-relation-edge/);
  assert.match(app,/width=1100,height=640/);
  assert.match(app,/groupCount=analysis\.groups\.length/);
  assert.match(app,/centerAngle=groupCount===2/);
  assert.match(app,/unplacedRadiusX=groupCount\?width\*\.43:width\*\.34/);
  assert.match(app,/<rect x="-54" y="-22" width="108" height="44"/);
  assert.match(css,/\.network-fixed-frame/);
  assert.match(css,/\.actual-relations \.network svg[\s\S]*width: 100%/);
  assert.match(css,/aspect-ratio: 1100 \/ 640/);
  assert.match(css,/\.relation-legend \{ position: static/);
  assert.match(css,/grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.relation-summary-grid/);
});

test('담임 관찰 포인트에는 관찰 기록 저장 버튼을 표시하지 않는다',()=>{
  assert.doesNotMatch(app,/data-save-relation-observation/);
  assert.doesNotMatch(app,/teacher_save_observation_auth[\s\S]{0,500}data-save-relation-observation/);
});

test('교사 홈은 중복 지원 신호 목록 없이 학생 단위 관찰 인원을 센다',()=>{
  assert.doesNotMatch(html,/id="signalList"/);
  assert.match(app,/observationStudents=new Set/);
  assert.match(app,/signal\.studentNumber/);
});

test('분석·설정 화면은 요청한 탭 구조를 제공한다',()=>{
  assert.match(html,/data-analysis-tab="ai"/);
  assert.match(html,/data-analysis-tab="overview"/);
  assert.match(html,/data-analysis-tab="pdf"/);
  assert.match(html,/data-settings-tab="class"/);
  assert.match(html,/data-settings-tab="pilot"/);
  assert.match(html,/data-settings-tab="governance"/);
});

test('학생 상세와 관계 분석은 안전한 초기 화면을 사용한다',()=>{
  assert.match(app,/<option value="">학생을 선택해 주세요<\/option>/);
  assert.match(app,/setRelationshipTab\('example'\)/);
  assert.match(html,/>누적 관계망<\/button>/);
});

test('첫 화면에서 교사 회원가입을 제공한다',()=>{
  const supabase=read('supabase.js');
  assert.match(html,/id="gateSignupButton"/);
  assert.match(html,/data-auth-mode="signup"/);
  assert.match(supabase,/async function teacherSignUp/);
  assert.match(supabase,/const redirectUrl=new URL\('\.',location\.href\)\.href/);
  assert.match(supabase,/signup\?redirect_to=\$\{encodeURIComponent\(redirectUrl\)\}/);
  assert.match(supabase,/function authErrorMessage/);
  assert.match(html,/id="authError" role="alert"/);
});

test('상단 고정 바는 로그인 계정과 로그아웃만 표시한다',()=>{
  const topbar=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]||'';
  assert.match(topbar,/id="authStatus"/);
  assert.match(topbar,/id="authButton"/);
  assert.doesNotMatch(topbar,/classEyebrow|pageTitle|학년도|관찰 기록/);
});
