const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const timeline=fs.readFileSync('student-support-timeline.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260724140000_student_monthly_review_cycles.sql','utf8');
const disableMigration=fs.readFileSync('supabase/migrations/20260724153000_disable_student_monthly_review_rpcs.sql','utf8');

test('학생 상세와 PDF는 교사 확인 이력을 연결하지 않고 설문 원문 이동을 유지한다',()=>{
  assert.doesNotMatch(timeline,/getObservations|signalReviews|data-edit-observation|studentSupportItems/);
  assert.doesNotMatch(app,/studentSupportTimelineSlot|renderStudentSupportTimeline|buildStudentSupportReportSection/);
  assert.match(app,/function openStudentAttentionResponse/);
  assert.match(app,/card\.open=true/);
  assert.match(app,/buildStudentOverviewPdfReport/);
  assert.match(timeline,/function buildStudentMonthlyResponseReportSection/);
});

test('기존 월별 담임 확인 데이터는 보존하되 교사 화면에서는 더 이상 불러오거나 저장하지 않는다',()=>{
  assert.match(migration,/create table if not exists public\.student_monthly_review_cycles/);
  assert.match(migration,/needs_review','reviewed','carry_forward','rapid_followup/);
  assert.match(migration,/status<>'rapid_followup' or follow_up_date is not null/);
  assert.match(migration,/teacher_get_student_review_cycles_auth/);
  assert.match(migration,/teacher_upsert_student_review_cycle_auth/);
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
  assert.match(migration,/student_monthly_review_updated/);
  assert.match(disableMigration,/revoke execute on function public\.teacher_get_student_review_cycles_auth\(text\) from authenticated/);
  assert.match(disableMigration,/revoke execute on function public\.teacher_upsert_student_review_cycle_auth\(text,uuid,date,text,text,date\) from authenticated/);
  assert.match(disableMigration,/기존 기록 보존용/);
  assert.doesNotMatch(timeline,/teacher_upsert_student_review_cycle_auth/);
  assert.doesNotMatch(app,/refreshStudentReviewCycles/);
});
