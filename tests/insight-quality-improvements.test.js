const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('analysis-dashboard.css','utf8');
const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');

test('학생 한눈에 보기는 현재·이전·여러 달 모습을 분리한다',()=>{
  assert.match(app,/function studentCurrentSnapshotHTML/);
  assert.match(app,/<h3>현재 모습<\/h3>/);
  assert.match(app,/<h3>이전과 달라진 점<\/h3>/);
  assert.match(app,/<h3>여러 달 이어진 모습<\/h3>/);
  assert.match(app,/recent\.length===3/);
});

test('반복 근거가 없으면 여러 달 영역을 숨긴다',()=>{
  assert.match(app,/insight\.patterns\.length\?`<section class="panel student-recurring-patterns"/);
  assert.match(app,/최근 3회 제출에서 친구 관계 점수 평균/);
  assert.match(app,/최근 3회 제출에서 긍정적인 친구 언급/);
});

test('AI 저장 전 선택 월·학생·단정 표현과 근거 참조를 검증한다',()=>{
  assert.match(edge,/mentionsForeignMonth/);
  assert.match(edge,/hasUnsafeConclusion/);
  assert.match(edge,/allowedStudents\.has\(item\.student\)/);
  assert.match(edge,/allowedRefs\.has\(String\(ref\)\)/);
  assert.match(edge,/currentStudentNumbers\.has\(number\)/);
});

test('관계 코칭은 계산된 기준과 맞지 않는 결과를 차단하고 안전 문장으로 보완한다',()=>{
  assert.match(edge,/signalByBasis\.has\(item\.coaching_basis\)/);
  assert.match(edge,/fallbackCoaching:Record<string,string>/);
  assert.match(edge,/\^\\\[계산 결과\\\]/);
  assert.match(edge,/analysis\.insights\.length/);
});

test('관계 AI 카드는 관계 모습에서 확인 장면과 학급 코칭으로 직접 이어진다',()=>{
  assert.match(app,/우리 반 관계 요약/);
  assert.match(app,/relationship-coaching-card/);
  assert.match(app,/<strong>관계에서 보이는 모습<\/strong>/);
  assert.match(app,/<strong>교실에서 살펴볼 점<\/strong>/);
  assert.match(app,/<strong>학급 코칭<\/strong>/);
  assert.match(css,/\.relationship-coaching-card/);
});
