const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20260720150000_stable_student_ids.sql','utf8');

test('홈 학급 변화는 고정 예시가 아니라 실제 응답으로 계산한다',()=>{
  assert.match(app,/function classMonthlyTrend\(responses\)/);
  assert.match(app,/renderClassTrend\(\)/);
  assert.doesNotMatch(html,/height:42%/);
});

test('관찰 입력·수정·삭제 UI와 RPC 연결은 제거하고 기존 DB 스키마는 보존한다',()=>{
  assert.doesNotMatch(html,/id="observation(?:Dialog|Fact|Status|Outcome|Board)"|id="saveObservation"/);
  assert.doesNotMatch(app,/teacher_(?:save|get|soft_delete)_observations?_auth|observationCache|openObservationForm/);
  const legacy=fs.readFileSync('supabase/migrations/20260720233000_observation_feedback_loop.sql','utf8');
  assert.match(legacy,/add column if not exists source_snapshot/);
});

test('학생 UUID 마이그레이션은 기존 응답과 관찰 기록을 연결한다',()=>{
  assert.match(migration,/survey_responses add column if not exists student_id/);
  assert.match(migration,/observations add column if not exists student_id/);
  assert.match(migration,/teacher_get_class_context_auth/);
});
