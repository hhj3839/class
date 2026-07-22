const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');
const app=read('app.js'),html=read('index.html'),student=read('student.js');
const edge=read('supabase/functions/analyze-class/index.ts');
const migration=read('supabase/migrations/20260720235900_pilot_evidence_metrics.sql');
const signalMetrics=read('supabase/migrations/20260722090000_signal_review_metrics.sql');
const limitMigration=read('supabase/migrations/20260720235930_ai_analysis_limit_10.sql');

test('학생 설문 완료 시간을 파일럿 지표용으로 저장한다',()=>{
  assert.match(student,/surveyStartedAt=Date\.now\(\)/);
  assert.match(student,/completionSeconds:/);
  assert.match(migration,/average_completion_seconds/);
});

test('AI 유용성 평가 버튼은 화면에서 제거하고 기존 감사 구조는 보존한다',()=>{
  assert.doesNotMatch(html,/data-ai-usefulness|id="aiUsefulness"/);
  assert.doesNotMatch(app,/teacher_set_ai_usefulness_auth/);
  assert.match(migration,/ai_usefulness_review/);
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
});

test('AI 근거는 응답 ID와 문항 경로를 검증한 뒤 원문으로 연결한다',()=>{
  assert.match(edge,/response_id:String\(row\.id\)/);
  assert.match(edge,/allowedRefs=new Set/);
  assert.match(edge,/source_refs=.*filter/);
  assert.match(app,/openAiSourceEvidence/);
  assert.match(app,/valueAtPath/);
});

test('관찰 결과 환류와 파일럿 지표를 집계한다',()=>{
  assert.match(html,/id="observationFeedbackSummary"/);
  assert.match(html,/id="pilotMetrics"/);
  assert.match(app,/renderObservationFeedbackSummary/);
  assert.match(migration,/observation_support_count/);
  assert.match(migration,/observation_no_issue_count/);
  assert.match(signalMetrics,/signal_review_checked_count/);
  assert.match(signalMetrics,/signal_review_resolved_count/);
  assert.match(signalMetrics,/support_connected','no_issue','closed/);
  assert.match(app,/안전 신호 확인/);
  assert.match(app,/안전 신호 처리/);
});

test('서로 다른 실제 교사 계정의 운영 학급 접근을 재시험할 수 있다',()=>{
  const smoke=read('supabase/tests/cross_teacher_access_smoke_test.sql');
  assert.match(smoke,/auth\.users/);
  assert.match(smoke,/teacher_get_class_context_auth/);
  assert.match(smoke,/ACCESS_CONTROL_TEST_FAILED/);
  assert.match(smoke,/cross_teacher_access_control/);
});

test('누적 관계망은 복잡한 지표 띠 없이 학급 관계 읽기를 제공한다',()=>{
  assert.match(app,/function cumulativeCoverage/);
  assert.match(app,/function relationshipMonthSnapshot/);
  assert.doesNotMatch(app,/누적 데이터 충족도|최근 월 강한 상호 연결|전월 대비 연결 변화/);
  assert.match(app,/우리 학급 관계 읽기/);
  assert.match(app,/1100×640 기준의 반응형 캔버스/);
});

test('새 AI 분석 한도는 기존 기록을 지우지 않고 월 10회로 확대한다',()=>{
  assert.match(limitMigration,/call_count>=10/);
  assert.match(limitMigration,/한도\(10회\)/);
  assert.doesNotMatch(limitMigration,/delete\s+from\s+public\.ai_analysis_runs/i);
});
