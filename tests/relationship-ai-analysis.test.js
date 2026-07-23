const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260722170000_relationship_ai_analysis.sql','utf8');

test('학급 분석과 관계 분석은 저장 유형과 실행 기록을 분리한다',()=>{
  assert.match(migration,/analysis_type text not null default 'class'/);
  assert.match(migration,/analysis_type in\('class','relationship'\)/);
  assert.match(migration,/teacher_get_cached_relationship_analysis_auth/);
  assert.match(migration,/teacher_begin_relationship_analysis_auth/);
  assert.match(migration,/analysis_type='class'/);
  assert.match(migration,/analysis_type='relationship'/);
});

test('관계 AI는 선택한 달의 익명 관계 계산과 이전 달 비교를 받아 학급 코칭을 생성한다',()=>{
  assert.match(edge,/analysisType='class'/);
  assert.match(edge,/analysisType==='relationship'/);
  assert.match(edge,/monthlyLatest/);
  assert.match(edge,/학생-\$\{Number\(row\.student_number\)\}/);
  assert.match(edge,/selected_month_mutual_high_relationships/);
  assert.match(edge,/관계 구조만 해석하세요/);
  assert.match(edge,/인기·고립·문제 학생으로 단정하거나 관계 원인을 추측하지 마세요/);
  assert.match(edge,/익명 번호 뒤에 '학생'을 붙여 언급/);
  assert.match(edge,/relationship-coaching-v10/);
  assert.match(edge,/teacher_get_class_context_auth/);
  assert.match(edge,/currentStudentNumbers\.has\(Number\(row\.student_number\)\)/);
  assert.match(edge,/currentStudentNumbers\.has\(Number\(item\.targetNumber\)\)/);
  assert.match(edge,/selected_month_summary/);
  assert.match(edge,/selected_month_students/);
  assert.match(edge,/previous_month_summary/);
  assert.match(edge,/이번 달에 보이는 변화/);
  assert.match(edge,/여러 달 이어진 관계 모습/);
  assert.match(edge,/응답이 적어 추가 확인 필요/);
  assert.match(edge,/class_coaching/);
  assert.doesNotMatch(edge,/operation_method:\{type:'string'\}/);
  assert.match(edge,/relationship_support_analysis/);
});

test('관계 모습별 코칭 기준을 계산해 학급 행동과 직접 연결한다',()=>{
  assert.match(edge,/coachingSignals/);
  assert.match(edge,/coaching_basis/);
  assert.match(edge,/상호 연결이 일부 학생에게 집중됨[\s\S]*발언·짝·모둠 참여 기회 넓히기/);
  assert.match(edge,/새 상호 연결이 나타남[\s\S]*새 협력 경험을 이어가는 행동 제안/);
  assert.match(edge,/친구별 응답 차이가 큼[\s\S]*여러 상황에서 서로의 모습을 알아보는 활동/);
  assert.match(edge,/응답이 부족함[\s\S]*관계를 단정하지 않고 자연스럽게 섞일 기회 제공/);
  assert.match(edge,/기존 연결이 이어짐[\s\S]*친한 관계를 유지하면서 다른 친구도 포함하는 행동/);
  assert.match(edge,/관계 모습과 무관한 일반적인 존중·배려 문장은 쓰지 마세요/);
  assert.match(edge,/coaching_signals:coachingSignals/);
});

test('관계 화면은 교사가 요청할 때 저장 결과 또는 새 AI 관계 코칭을 표시한다',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/data-relation-tab="example"[^>]*>표시 방법<\/button>/);
  assert.match(html,/data-relation-tab="actual"[^>]*>월별 관계 지도<\/button>/);
  assert.match(html,/data-relation-tab="ai"[^>]*>AI 관계 코칭<\/button>/);
  assert.match(html,/id="relationAiPanel" role="tabpanel" hidden/);
  assert.match(app,/actual\.hidden=tab!=='actual';ai\.hidden=tab!=='ai'/);
  assert.match(app,/panel ai-analysis-panel relationship-actions/);
  assert.match(app,/class="ai-review-actions"/);
  assert.match(app,/id="relationshipAiMeta">마지막 분석 확인 전/);
  assert.match(html,/id="relationshipAnalysisMonth"/);
  assert.match(app,/relationship-ai-head/);
  assert.match(app,/<h3>AI 관계 코칭<\/h3><div class="ai-review-actions"><span class="confidence"/);
  assert.match(app,/id="runRelationshipAi">저장된 결과 불러오기/);
  assert.match(app,/id="rerunRelationshipAi">AI 새 분석/);
  assert.match(app,/마지막 분석 \$\{formatAnalysisTimestamp\(meta\.generatedAt\)\}/);
  assert.match(app,/analysisType:'relationship'/);
  assert.match(app,/month:relationshipAnalysisMonth\(\)/);
  assert.match(app,/function renderRelationshipAiAnalysis/);
  assert.match(app,/교실에서 살펴볼 점/);
  assert.match(app,/<summary>분석 근거<\/summary>/);
  assert.match(app,/학급 코칭/);
  assert.doesNotMatch(app,/<strong>학급 운영 방법<\/strong>/);
  assert.match(app,/relationship-insight-heading/);
  assert.match(app,/안전하게 분석 중…/);
  assert.match(app,/replace\(\/학생\\s\+학생\/g,'학생'\)/);
  assert.match(app,/function relationshipAnalysisHasFormerStudents/);
  assert.match(app,/이전 명단 학생이 포함된 저장 결과입니다/);
});

test('관계 AI 카드는 핵심 관계 문장과 근거 범위를 먼저 표시한다',()=>{
  const css=fs.readFileSync('analysis-dashboard.css','utf8');
  assert.match(edge,/title:\{type:'string'\}/);
  assert.match(edge,/timeframe:\{type:'string',enum:/);
  assert.match(app,/conciseAiSentence\(item\.observation\|\|item\.title/);
  assert.match(css,/\.relationship-insight-heading/);
});

test('이전 형식의 저장 관계 분석은 새 분석을 권장한다',()=>{
  assert.match(edge,/upgradeRecommended=analysisType==='relationship'[\s\S]*coaching_basis/);
  assert.match(edge,/analysisVersion:upgradeRecommended\?'이전 저장 형식':selectedVersion/);
  assert.match(app,/이전 형식으로 저장된 결과입니다/);
  assert.match(app,/AI 새 분석을 실행해 주세요/);
  assert.match(app,/meta\.upgradeRecommended\?'이전 저장 결과'/);
});
