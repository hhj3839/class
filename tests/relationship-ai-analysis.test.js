const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260722170000_relationship_ai_analysis.sql','utf8');

test('학급 분석과 관계 분석은 저장 유형과 월별 호출 한도를 분리한다',()=>{
  assert.match(migration,/analysis_type text not null default 'class'/);
  assert.match(migration,/analysis_type in\('class','relationship'\)/);
  assert.match(migration,/teacher_get_cached_relationship_analysis_auth/);
  assert.match(migration,/teacher_begin_relationship_analysis_auth/);
  assert.match(migration,/analysis_type='class'/);
  assert.match(migration,/analysis_type='relationship'/);
});

test('관계 AI는 누적 익명 관계 계산만 받아 학급 운영 문장을 생성한다',()=>{
  assert.match(edge,/analysisType='class'/);
  assert.match(edge,/analysisType==='relationship'/);
  assert.match(edge,/monthlyLatest/);
  assert.match(edge,/학생-\$\{Number\(row\.student_number\)\}/);
  assert.match(edge,/mutual_high_relationships/);
  assert.match(edge,/관계 구조만 해석하세요/);
  assert.match(edge,/인기·고립·문제 학생으로 단정하거나 관계 원인을 추측하지 마세요/);
  assert.match(edge,/익명 번호 뒤에 '학생'을 붙여 언급/);
  assert.match(edge,/relationship-coaching-v3/);
  assert.match(edge,/class_coaching/);
  assert.match(edge,/operation_method/);
  assert.match(edge,/relationship_support_analysis/);
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
  assert.match(app,/id="runRelationshipAi">저장된 결과 불러오기/);
  assert.match(app,/id="rerunRelationshipAi">AI 새 분석/);
  assert.match(app,/마지막 분석 \$\{formatAnalysisTimestamp\(meta\.generatedAt\)\}/);
  assert.match(app,/analysisType:'relationship'/);
  assert.match(app,/function renderRelationshipAiAnalysis/);
  assert.match(app,/관계에서 보이는 모습/);
  assert.match(app,/담임이 확인할 장면/);
  assert.match(app,/학급 코칭/);
  assert.match(app,/학급 운영 방법/);
  assert.match(app,/안전하게 분석 중…/);
  assert.match(app,/replace\(\/학생\\s\+학생\/g,'학생'\)/);
});
