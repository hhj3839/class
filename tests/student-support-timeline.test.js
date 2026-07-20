const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const timeline=fs.readFileSync('student-support-timeline.js','utf8');

test('학생 상세는 설문·안전 신호·관찰 결과를 하나의 지원 타임라인으로 연결한다',()=>{
  assert.match(html,/student-support-timeline\.js/);
  assert.match(timeline,/studentMonthlyResponses/);
  assert.match(timeline,/signalReviews\.filter/);
  assert.match(timeline,/getObservations\(\)\.filter/);
  assert.match(timeline,/학생 지원 타임라인/);
});

test('학생 지원 타임라인은 미완료 건수와 다음 확인일을 표시한다',()=>{
  assert.match(timeline,/openSignals/);
  assert.match(timeline,/openObservations/);
  assert.match(timeline,/다음 확인일/);
  assert.match(timeline,/data-edit-observation/);
});
