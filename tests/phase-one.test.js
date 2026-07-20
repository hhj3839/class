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
  assert.match(app,/관찰 확인 기록을 DB에 저장했습니다/);
});

test('관찰 확인은 독립 기록으로 작성하고 상세 기록은 선택적으로 연다',()=>{
  assert.doesNotMatch(app,/data-ai-observation|attachAiObservationActions|openAiObservationForm/);
  assert.match(html,/30초 관찰 확인/);
  assert.match(html,/확인한 사실/);
  assert.match(html,/학생과 나눈 이야기/);
  assert.match(html,/상세 기록 추가\(선택\)/);
  assert.match(html,/특이사항 없음/);
});

test('관찰 진행 상태와 확인 결과를 분리하고 출처 필드를 보존한다',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260720233000_observation_feedback_loop.sql','utf8');
  assert.match(html,/id="observationStatus"/);
  assert.match(html,/id="observationOutcome"/);
  assert.doesNotMatch(html,/id="observationFact" required/);
  assert.match(app,/status==='done'&&!observedFact/);
  assert.match(app,/status==='done'&&outcome==='pending'/);
  assert.match(app,/aiRunId:item\.aiRunId/);
  assert.match(app,/sourceType:item\.sourceType/);
  assert.match(app,/sourceSnapshot:item\.sourceSnapshot/);
  assert.match(migration,/add column if not exists outcome/);
  assert.match(migration,/add column if not exists ai_run_id/);
  assert.match(migration,/add column if not exists source_snapshot/);
  assert.match(migration,/observation_saved/);
});

test('관찰 기록은 감사 로그가 남는 소프트 삭제를 지원한다',()=>{
  const migration=fs.readFileSync('supabase/migrations/20260720234500_observation_soft_delete.sql','utf8');
  assert.match(app,/data-delete-observation/);
  assert.match(app,/teacher_soft_delete_observation_auth/);
  assert.match(app,/삭제 사유를 입력해 주세요/);
  assert.match(migration,/deleted_at is null/);
  assert.match(migration,/observation_soft_delete/);
});

test('학생 UUID 마이그레이션은 기존 응답과 관찰 기록을 연결한다',()=>{
  assert.match(migration,/survey_responses add column if not exists student_id/);
  assert.match(migration,/observations add column if not exists student_id/);
  assert.match(migration,/teacher_get_class_context_auth/);
});
