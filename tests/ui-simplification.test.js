const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const app=read('app.js');
const studentRecordCss=read('student-record.css');

test('설문 관리는 학생 설문 링크와 제출 현황만 탭으로 구분한다',()=>{
  const html=read('index.html');
  assert.match(html,/data-survey-admin-tab="link"[^>]*>학생 설문 링크/);
  assert.match(html,/data-survey-admin-tab="status"[^>]*>제출 현황/);
  assert.match(html,/id="surveyStatusPanel"[^>]*hidden/);
  assert.doesNotMatch(html,/data-survey-admin-tab="correction"/);
  assert.match(html,/id="responseCorrectionPanel"[^>]*hidden[^>]*aria-hidden="true"/);
  assert.match(html,/학생 설문 접속/);
  assert.match(html,/새 설문 링크 만들기/);
  assert.match(html,/제출 현황 새로고침/);
  assert.match(app,/panels=\{link:\$\('#surveyLinkPanel'\),status:\$\('#surveyStatusPanel'\)\}/);
});

test('학급 분석은 전체 현황 없이 AI·우리 반 모습·즉시 PDF를 제공한다',()=>{
  assert.match(html,/data-analysis-tab="ai"/);
  assert.match(html,/data-analysis-tab="patterns"/);
  assert.match(html,/id="analysisPatternsPanel"[^>]*hidden/);
  assert.match(html,/id="printReport"/);
  assert.match(html,/우리 반에서 보이는 모습/);
  assert.match(html,/분석 결과 PDF 저장/);
  assert.doesNotMatch(html,/data-analysis-tab="overview"|id="analysisOverviewPanel"|class="filter-tabs"/);
});

test('관계 분석 결과와 관찰 포인트에서 비대칭·이번 주 단계를 제거한다',()=>{
  const app=read('app.js');
  const relationView=app.slice(app.indexOf('function renderRelationshipsV2'),app.indexOf('function setRelationshipTab'));
  const actions=app.slice(app.indexOf('function renderRelationshipActions'),app.indexOf('// 관계 분석은'));
  assert.doesNotMatch(relationView,/asymmetric|비대칭/);
  assert.doesNotMatch(actions,/비대칭|이번 주|지속 관찰/);
  assert.match(actions,/AI 관계 해석/);
  assert.match(actions,/관계에서 보이는 모습/);
});

test('누적 관계망은 중앙 균형 배치와 별도 범례 표를 제공한다',()=>{
  const app=read('app.js'),css=read('analysis-dashboard.css');
  assert.match(app,/id="relationStudentFocus"/);
  assert.match(app,/data-relation-edge/);
  assert.match(app,/width=1100,height=640/);
  assert.match(app,/groupCount=analysis\.groups\.length/);
  assert.match(app,/centerAngle=groupCount===2/);
  assert.match(app,/unplacedRadiusX=groupCount\?width\*\.43:width\*\.34/);
  assert.match(app,/<rect x="-60" y="-22" width="120" height="44"/);
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
  assert.match(html,/우리 반 현황/);
  assert.match(html,/이번 달 설문 참여/);
  assert.match(html,/바로 확인할 학생/);
  assert.match(html,/살펴볼 학생/);
  assert.match(html,/친절·성장 응답/);
});

test('분석은 월 선택을 탭 옆에 두고 설정은 학급 관리만 노출한다',()=>{
  assert.match(html,/data-analysis-tab="ai"/);
  assert.match(html,/data-analysis-tab="patterns"/);
  assert.match(html,/id="printReport"/);
  assert.doesNotMatch(html,/data-analysis-tab="overview"|data-analysis-tab="pdf"/);
  assert.match(html,/class="analysis-toolbar"/);
  assert.match(html,/class="student-picker analysis-month-picker"/);
  assert.doesNotMatch(html,/<span>살펴볼 달<\/span>/);
  assert.doesNotMatch(html,/data-settings-tab=/);
  assert.match(html,/id="settingsPilotPanel"[^>]*hidden/);
  assert.match(html,/id="settingsGovernancePanel"[^>]*hidden/);
});

test('우리 반에서 보이는 모습은 별도 탭으로 옮기고 지난 제출 현황은 기본 접힘으로 표시한다',()=>{
  const aiRender=app.slice(app.indexOf('function renderAiAnalysis'),app.indexOf('async function runAiAnalysis'));
  const monthlyRender=app.slice(app.indexOf('function renderMonthlySurveyAccordion'),app.indexOf('function applyAnalysisMonth'));
  assert.match(aiRender,/renderClassObservationPatterns\(patterns,display\)/);
  assert.doesNotMatch(aiRender,/학급 단위 관찰 패턴 보기/);
  assert.match(app,/function renderClassObservationPatterns\(/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderClassObservationPatterns'),app.indexOf('function renderAiAnalysis')),/<details/);
  assert.match(html,/우리 반에서 보이는 모습/);
  assert.match(monthlyRender,/지난 설문 제출 현황/);
  assert.match(monthlyRender,/return`<details><summary>/);
  assert.doesNotMatch(monthlyRender,/<details \$\{[^}]*open/);
});

test('교사 홈과 학생 상세는 단순화된 탐색 구조를 사용한다',()=>{
  const support=read('student-support-timeline.js');
  assert.match(html,/class="panel signal-review-panel"[^>]*hidden/);
  assert.doesNotMatch(html,/data-view="observations"/);
  assert.match(app,/최근 제출일/);
  assert.match(app,/친구 관계 점수 평균/);
  assert.match(app,/id="studentSupportTimelineSlot"/);
  assert.match(support,/querySelector\('#studentSupportTimelineSlot'\)/);
  assert.match(app,/data-student-detail-panel="summary"/);
  assert.match(app,/data-student-detail-panel="trend"[^>]*hidden/);
  assert.match(app,/data-student-detail-panel="trend"[^`]*studentSupportTimelineSlot/);
  assert.match(app,/data-student-detail-panel="responses"[^>]*hidden/);
  assert.match(html,/class="student-toolbar"/);
  assert.match(html,/class="student-toolbar-actions"/);
  assert.doesNotMatch(html,/학생 바꾸기|studentDetailMeta/);
  assert.match(html,/id="previousStudent"/);
  assert.match(html,/id="nextStudent"/);
  assert.match(html,/id="printStudentReport"/);
  assert.match(studentRecordCss,/\.student-picker::after/);
  assert.match(studentRecordCss,/appearance:\s*none/);
  assert.match(studentRecordCss,/\.student-picker:focus-within/);
  assert.doesNotMatch(app,/student-identity-bar|student-context-sticky/);
});

test('관계 분석은 핵심 학생군과 학급 이해 문장만 표시한다',()=>{
  const relationView=app.slice(app.indexOf('function renderRelationshipsV2'),app.indexOf('function setRelationshipTab'));
  assert.doesNotMatch(relationView,/상호 높은 관계가 밀집된 묶음|여러 집단과 연결된 학생|relation-trend-strip/);
  assert.doesNotMatch(relationView,/친구에 따라 받은 관계 점수가 다른 학생|강한 상호 연결이 적게 나타난 학생/);
  assert.match(app,/AI 관계 해석/);
  assert.match(app,/관계에서 보이는 모습/);
  assert.match(app,/학급 운영과 코칭/);
  assert.doesNotMatch(app,/친구별 평가 편차/);
});

test('AI 학생 카드는 해석·살펴볼 점·다음 지원만 바로 보여주고 다른 해석은 숨긴다',()=>{
  const aiRender=app.slice(app.indexOf('function renderAiAnalysis'),app.indexOf('async function runAiAnalysis'));
  assert.match(aiRender,/담임 해석/);
  assert.match(aiRender,/담임이 살펴볼 점/);
  assert.match(aiRender,/<strong>다음 대화와 지원<\/strong>/);
  assert.doesNotMatch(aiRender,/가능한 다른 해석 보기|ai-interpretations/);
});

test('학생 상세와 관계 분석은 안전한 초기 화면을 사용한다',()=>{
  assert.match(app,/<option value="">학생을 선택해 주세요<\/option>/);
  assert.match(app,/setRelationshipTab\('example'\)/);
  assert.match(html,/>우리 반 관계 지도<\/button>/);
  assert.doesNotMatch(html,/추정 집단|양극화 후보|표준편차|강한 상호 연결/);
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

test('메뉴 설명은 본문 대신 각 메뉴 버튼의 툴팁으로 제공한다',()=>{
  const css=read('styles.css');
  const navItems=[...html.matchAll(/<button class="nav-item[^"]*"[^>]*>/g)].map(match=>match[0]);
  assert.equal(navItems.length,6);
  navItems.forEach(item=>{
    assert.match(item,/data-tooltip="[^"]+"/);
    assert.match(item,/aria-description="[^"]+"/);
  });
  assert.doesNotMatch(html,/참여 링크를 공유하고 제출 현황을 확인하세요/);
  assert.doesNotMatch(html,/AI 분석, 전체 현황, PDF 저장을 탭으로 구분했습니다/);
  assert.doesNotMatch(html,/미제출 월은 비워 두고, 실제 제출한 월의 최신 응답만 연결합니다/);
  assert.match(css,/\.nav-item::after\{content:attr\(data-tooltip\)/);
  assert.match(css,/\.nav-item:hover::after,\.nav-item:focus-visible::after/);
});

test('이메일 인증 복귀 화면은 성공·실패를 안내하고 인증 토큰을 주소에서 제거한다',()=>{
  assert.match(html,/id="authCallbackNotice" role="status" hidden/);
  assert.match(app,/function handleAuthCallbackNotice\(\)/);
  assert.match(app,/이메일 인증이 완료되었습니다/);
  assert.match(app,/이메일 인증에 실패했습니다/);
  assert.match(app,/fragment\.has\('access_token'\)/);
  assert.match(app,/history\.replaceState/);
  assert.match(app,/handleAuthCallbackNotice\(\);renderAuthState\(\)/);
});

test('교사 비밀번호 재설정 요청과 콜백 변경 흐름을 제공한다',()=>{
  const supabase=read('supabase.js');
  assert.match(html,/id="authRecoveryButton"[^>]*>비밀번호를 잊으셨나요\?/);
  assert.match(supabase,/auth\/v1\/recover\?redirect_to=/);
  assert.match(supabase,/async function teacherUpdatePassword/);
  assert.match(supabase,/method:'PUT'/);
  assert.match(app,/type==='recovery'/);
  assert.match(app,/openAuthDialog\('recovery'\)/);
  assert.match(app,/teacherRequestPasswordReset\(email\)/);
  assert.match(app,/teacherUpdatePassword\(password\)/);
});

test('교사 세션은 만료 전에 자동 갱신하고 401 요청을 한 번 재시도한다',()=>{
  const supabase=read('supabase.js');
  assert.match(supabase,/function setTeacherSession\(session\).*expires_at/);
  assert.match(supabase,/async function refreshTeacherSession/);
  assert.match(supabase,/grant_type=refresh_token/);
  assert.match(supabase,/async function getValidTeacherSession/);
  assert.match(supabase,/Math\.floor\(Date\.now\(\)\/1000\)\+60/);
  assert.match(supabase,/if\(response\.status!==401\)return response/);
  assert.doesNotMatch(supabase,/localStorage\.setItem/);
});
