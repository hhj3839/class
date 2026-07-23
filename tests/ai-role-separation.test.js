const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');

test('우리 반 응답 흐름은 규칙 기반 지표를 AI 결과와 분리한다',()=>{
  assert.match(html,/data-analysis-tab="patterns"[^>]*>우리 반 응답 흐름<\/button>/);
  assert.match(html,/id="classResponseFlowMetrics"/);
  assert.match(app,/function classResponseFlowData/);
  assert.match(app,/aiTeacherDisplayText\(cleanAiEvidenceText\(value\)\)/);
  assert.match(app,/설문 참여/);
  assert.match(app,/학교생활 자기평가/);
  assert.match(app,/친구 관계 응답/);
  assert.match(app,/교사와 대화 희망/);
  assert.match(app,/바로 확인할 응답/);
});

test('AI 학생 지원은 교사가 바로 쓰는 네 가지 역할로 구성한다',()=>{
  assert.match(html,/data-analysis-tab="ai"[^>]*>AI 학생 지원<\/button>/);
  assert.match(app,/담임 참고 · 확인할 장면 · 학생 코칭 · 다음 지원 방향/);
  assert.match(app,/담임이 확인할 장면/);
  assert.match(app,/학생 코칭/);
  assert.match(app,/다음 지원 방향/);
  assert.match(edge,/실제 건넬 수 있는 말 한 문장을 60자 이내/);
});

test('AI 관계 코칭은 관계 모습·확인 장면·학급 코칭으로 간결하게 구성한다',()=>{
  assert.match(html,/data-relation-tab="ai"[^>]*>AI 관계 코칭<\/button>/);
  assert.match(edge,/class_coaching/);
  assert.match(edge,/학급 운영 방법은 별도 항목으로 만들지 말고/);
  assert.match(app,/학급 코칭/);
  assert.doesNotMatch(app,/<strong>학급 운영 방법<\/strong>/);
  assert.match(edge,/60자 이내의 한 문장으로만 작성하세요/);
});

test('AI 학생 지원 항목은 한 열로 표시한다',()=>{
  const css=fs.readFileSync('analysis-dashboard.css','utf8');
  assert.match(css,/\.ai-student-support-grid\{display:grid;grid-template-columns:1fr;/);
});
