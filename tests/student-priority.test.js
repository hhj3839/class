const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const priority=fs.readFileSync('student-priority.js','utf8');

test('교사 홈은 미처리 신호와 관찰 기록을 학생 단위로 통합한다',()=>{
  assert.match(html,/담임 확인 우선순위/);
  assert.match(html,/위험도 순위가 아니라/);
  assert.match(priority,/signalReviewFor/);
  assert.match(priority,/getObservations\(\)/);
  assert.match(priority,/resolved\.has/);
});

test('우선순위는 즉시 확인과 기한 경과를 먼저 보여주고 학생 상세로 연결한다',()=>{
  assert.match(priority,/signal\.type==='urgent'\?100/);
  assert.match(priority,/follow_up_date<today/);
  assert.match(priority,/data-priority-student/);
  assert.match(priority,/student-detail/);
});
