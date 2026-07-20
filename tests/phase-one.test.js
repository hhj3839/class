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

test('관찰 기록은 사실·해석·면담·후속조치를 구분해 편집한다',()=>{
  for(const id of ['observationFact','observationInterpretation','observationInterview','observationFollowUp']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/관찰·상담 기록을 DB에 저장했습니다/);
});

test('학생 UUID 마이그레이션은 기존 응답과 관찰 기록을 연결한다',()=>{
  assert.match(migration,/survey_responses add column if not exists student_id/);
  assert.match(migration,/observations add column if not exists student_id/);
  assert.match(migration,/teacher_get_class_context_auth/);
});
