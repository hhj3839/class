const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const support=fs.readFileSync('student-support-timeline.js','utf8');
const priority=fs.readFileSync('student-priority.js','utf8');
const safety=fs.readFileSync('safety-signals.js','utf8');

test('확장 화면은 전역 렌더 함수를 덮어쓰지 않고 데이터 갱신 이벤트를 구독한다',()=>{
  assert.doesNotMatch(support,/renderStudentDetail\s*=/);
  assert.doesNotMatch(priority,/renderHomeSignals\s*=/);
  assert.doesNotMatch(priority,/renderObservations\s*=/);
  assert.match(support,/class-ieum:data-updated/);
  assert.match(priority,/class-ieum:data-updated/);
});

test('응답·관찰·안전 신호 변경은 하나의 갱신 이벤트로 확장 화면에 전달된다',()=>{
  assert.match(app,/applyAnalysisMonth\(\).*class-ieum:data-updated/s);
  assert.match(app,/function saveObservations.*class-ieum:data-updated/);
  assert.match(safety,/class-ieum:data-updated/);
});
