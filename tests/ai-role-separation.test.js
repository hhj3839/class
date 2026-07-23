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
  assert.match(app,/result\.split\(name\)\.join\('개별 학생'\)/);
  assert.match(app,/설문 참여/);
  assert.match(app,/학교생활 자기평가/);
  assert.match(app,/친구 관계 응답/);
  assert.match(app,/교사와 대화 희망/);
  assert.match(app,/바로 확인할 응답/);
});

test('AI 학생 지원은 교사가 바로 쓰는 네 가지 역할로 구성한다',()=>{
  assert.match(html,/data-analysis-tab="ai"[^>]*>AI 학생 지원<\/button>/);
  assert.match(app,/응답에서 살펴볼 점/);
  assert.match(app,/담임이 확인할 장면/);
  assert.match(app,/학생 코칭/);
  assert.match(app,/다음 지원 방향/);
  assert.match(edge,/실제 건넬 수 있는 말 한 문장을 60자 이내/);
});

test('AI 관계 코칭은 학급 코칭과 운영 방법을 분리한다',()=>{
  assert.match(html,/data-relation-tab="ai"[^>]*>AI 관계 코칭<\/button>/);
  assert.match(edge,/class_coaching/);
  assert.match(edge,/operation_method/);
  assert.match(app,/학급 코칭/);
  assert.match(app,/학급 운영 방법/);
});
