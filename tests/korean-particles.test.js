const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function hasKoreanBatchim');
const end=app.indexOf('function conciseAiSentence');
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
  assert.equal(context.aiTeacherDisplayText('학생-1번은 확인이 필요합니다.'),'최다온은 확인이 필요합니다.');
  assert.equal(context.aiTeacherDisplayText('학생#2가 참여했습니다.'),'하나가 참여했습니다.');
  assert.equal(context.aiTeacherDisplayText('1번과 2번 학생은 함께했습니다.'),'최다온과 하나는 함께했습니다.');
  assert.equal(context.aiTeacherDisplayText('학생-1명과 학생-2명을 살펴봅니다.'),'최다온과 하나를 살펴봅니다.');
});

test('AI가 점이나 쉼표로 묶어 쓴 학생 번호도 모두 실제 이름으로 바꾼다',()=>{
  assert.equal(context.aiTeacherDisplayText('학생-1·2는 함께 연결됐습니다.'),'최다온·하나는 함께 연결됐습니다.');
  assert.equal(context.aiTeacherDisplayText('학생-1, 2와 활동했습니다.'),'최다온·하나와 활동했습니다.');
  assert.equal(context.aiTeacherDisplayText('학생-1/5가 포함됐습니다.'),'최다온·이전 명단 학생이 포함됐습니다.');
});

test('AI 결과의 도움 요청 조사를 자연스럽게 보정한다',()=>{
  assert.equal(context.aiTeacherDisplayText('도움 요청가 확인되었습니다.'),'도움 요청이 확인되었습니다.');
  assert.equal(context.aiTeacherDisplayText('도움 요청는 없습니다.'),'도움 요청은 없습니다.');
});

test('AI 학생 지원 요약은 상세 카드의 학생과 우선순위를 그대로 사용한다',()=>{
  const priority=[
    {student:'학생-1',priority:'즉시 확인'},
    {student:'학생-2',priority:'지속 관찰'}
  ];
  assert.equal(context.aiPrioritySummary(priority),'최다온은 먼저 확인하고, 하나는 대화와 관찰로 살펴보세요.');
  assert.equal(context.aiPrioritySummary(priority,false),'바로 확인할 학생 1명 · 대화와 관찰로 살펴볼 학생 1명이 표시되었습니다.');
});
