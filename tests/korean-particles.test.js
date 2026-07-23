const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function hasKoreanBatchim');
const end=app.indexOf('function cleanAiEvidenceText');
const context={classSettings:{students:[{number:1,name:'최다온'},{number:2,name:'하나'}]},cleanAiEvidenceText:value=>String(value||'')};
vm.createContext(context);
vm.runInContext(app.slice(start,end),context);

test('AI 익명 번호를 실제 이름으로 바꿀 때 받침에 맞는 조사를 사용한다',()=>{
  assert.equal(context.aiTeacherDisplayText('학생-1는 확인이 필요합니다.'),'최다온은 확인이 필요합니다.');
  assert.equal(context.aiTeacherDisplayText('학생-2은 확인이 필요합니다.'),'하나는 확인이 필요합니다.');
  assert.equal(context.aiTeacherDisplayText('학생-1와 대화합니다.'),'최다온과 대화합니다.');
  assert.equal(context.aiTeacherDisplayText('학생-2으로 이동합니다.'),'하나로 이동합니다.');
});

test('현재 명단에 없는 익명 번호는 내부 번호 대신 이전 명단 학생으로 표시한다',()=>{
  assert.equal(context.aiTeacherDisplayText('학생-5는 과거 응답에 포함됐습니다.'),'이전 명단 학생은 과거 응답에 포함됐습니다.');
  assert.equal(context.aiTeacherDisplayText('5번 학생과 대화 기록이 있습니다.'),'이전 명단 학생과 대화 기록이 있습니다.');
  assert.doesNotMatch(context.aiTeacherDisplayText('학생-5의 응답입니다.'),/학생-5/);
});

test('우리 반 응답 흐름의 익명 번호도 교사 화면에서 실제 이름으로 바꾼다',()=>{
  assert.equal(context.aiTeacherDisplayText('학생-1와 학생-2는 대화를 원합니다.'),'최다온과 하나는 대화를 원합니다.');
});

test('AI 결과의 도움 요청 조사를 자연스럽게 보정한다',()=>{
  assert.equal(context.aiTeacherDisplayText('도움 요청가 확인되었습니다.'),'도움 요청이 확인되었습니다.');
  assert.equal(context.aiTeacherDisplayText('도움 요청는 없습니다.'),'도움 요청은 없습니다.');
});
