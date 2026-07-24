const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const timeline=fs.readFileSync('student-support-timeline.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260724140000_student_monthly_review_cycles.sql','utf8');

test('학생별 살펴보기는 설문·월별 담임 확인·확인 필요 응답·교사 확인 결과를 하나의 이력으로 연결한다',()=>{
  assert.match(html,/student-support-timeline\.js/);
  assert.match(timeline,/studentMonthlyResponses/);
  assert.match(timeline,/studentReviewCycles\.filter/);
  assert.match(timeline,/signalReviews\.filter/);
  assert.match(timeline,/getObservations\(\)\.filter/);
  assert.match(timeline,/담임 확인 이력/);
});

test('담임 확인은 월별 설문 주기와 예외적인 빠른 추가 확인을 구분한다',()=>{
  assert.match(timeline,/openSignals/);
  assert.match(timeline,/openObservations/);
  assert.match(timeline,/다음 설문에서 다시 보기/);
  assert.match(timeline,/빠른 추가 확인/);
  assert.match(timeline,/data-student-review-date-wrap/);
  assert.doesNotMatch(timeline,/다음 확인 예정일/);
  assert.match(timeline,/data-edit-observation/);
  assert.match(timeline,/담임 확인 이력 보기/);
  assert.match(timeline,/if\(!supportItems\.length\)/);
  assert.match(timeline,/<details class="student-support-details">/);
});

test('확인·지원 이력은 월·살펴볼 기록으로 필터링한다',()=>{
  assert.match(timeline,/studentSupportFilters=\{month:'all',kind:'all'\}/);
  assert.match(timeline,/data-support-filter="month"/);
  assert.match(timeline,/data-support-filter="kind"/);
  assert.match(timeline,/filteredStudentSupportItems/);
  assert.match(timeline,/살펴볼 기록/);
  assert.match(timeline,/전체 기록/);
  assert.match(timeline,/월별 담임 확인/);
});

test('학생 개인 PDF는 최근 확인·지원 이력 요약을 포함한다',()=>{
  assert.match(html,/id="printStudentReport"/);
  assert.match(timeline,/function buildStudentSupportReportSection/);
  assert.match(timeline,/담임 확인 이력 요약/);
  assert.match(timeline,/recent=items\.slice\(0,8\)/);
  assert.match(timeline,/function buildStudentOverviewReportSection/);
  assert.match(timeline,/function buildStudentMonthlyResponseReportSection/);
  assert.match(app,/scope==='class'&&currentAiAnalysis/);
  assert.match(app,/scope==='student'\?buildStudentOverviewReportSection/);
  assert.match(app,/\$\('#reportScope'\)\.value==='student'\?\$\('#printStudentReport'\):\$\('#printReport'\)/);
});

test('월별 담임 확인 상태는 담당 교사 RPC로 저장하고 빠른 확인에만 날짜를 요구한다',()=>{
  assert.match(migration,/create table if not exists public\.student_monthly_review_cycles/);
  assert.match(migration,/needs_review','reviewed','carry_forward','rapid_followup/);
  assert.match(migration,/status<>'rapid_followup' or follow_up_date is not null/);
  assert.match(migration,/teacher_get_student_review_cycles_auth/);
  assert.match(migration,/teacher_upsert_student_review_cycle_auth/);
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
  assert.match(migration,/student_monthly_review_updated/);
  assert.match(timeline,/teacher_upsert_student_review_cycle_auth/);
  assert.match(app,/refreshStudentReviewCycles/);
});
