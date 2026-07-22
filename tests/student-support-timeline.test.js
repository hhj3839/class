const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const timeline=fs.readFileSync('student-support-timeline.js','utf8');
const app=fs.readFileSync('app.js','utf8');

test('학생별 살펴보기는 설문·확인 필요 응답·교사 확인 결과를 하나의 이력으로 연결한다',()=>{
  assert.match(html,/student-support-timeline\.js/);
  assert.match(timeline,/studentMonthlyResponses/);
  assert.match(timeline,/signalReviews\.filter/);
  assert.match(timeline,/getObservations\(\)\.filter/);
  assert.match(timeline,/확인·지원 이력/);
});

test('확인·지원 이력은 진행 중 건수와 다음 확인 예정일을 표시한다',()=>{
  assert.match(timeline,/openSignals/);
  assert.match(timeline,/openObservations/);
  assert.match(timeline,/다음 확인 예정일/);
  assert.match(timeline,/data-edit-observation/);
});

test('확인·지원 이력은 월·살펴볼 기록으로 필터링한다',()=>{
  assert.match(timeline,/studentSupportFilters=\{month:'all',kind:'all'\}/);
  assert.match(timeline,/data-support-filter="month"/);
  assert.match(timeline,/data-support-filter="kind"/);
  assert.match(timeline,/filteredStudentSupportItems/);
  assert.match(timeline,/살펴볼 기록/);
  assert.match(timeline,/전체 기록/);
  assert.match(timeline,/날짜 미정/);
  assert.match(timeline,/예정 없음/);
});

test('학생 개인 PDF는 최근 확인·지원 이력 요약을 포함한다',()=>{
  assert.match(html,/id="printStudentReport"/);
  assert.match(timeline,/function buildStudentSupportReportSection/);
  assert.match(timeline,/확인·지원 이력 요약/);
  assert.match(timeline,/recent=items\.slice\(0,8\)/);
  assert.match(timeline,/function buildStudentOverviewReportSection/);
  assert.match(timeline,/function buildStudentMonthlyResponseReportSection/);
  assert.match(app,/scope==='class'&&currentAiAnalysis/);
  assert.match(app,/scope==='student'\?buildStudentOverviewReportSection/);
  assert.match(app,/\$\('#reportScope'\)\.value==='student'\?\$\('#printStudentReport'\):\$\('#printReport'\)/);
});
