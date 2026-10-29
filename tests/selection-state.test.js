const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
function block(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}
function harness() {
  const fields = new Map(['#analysisMonth', '#surveyMonth', '#studentDetailSelect', '#printStudentReport'].map(id => [id, {value: '', disabled: false}]));
  let renders = 0;
  const context = vm.createContext({
    Date, selectedAnalysisMonth: '', activeStudentDetailTab: 'trend',
    classSettings: {classId: 'a', students: [{number: 1}, {number: 2}]},
    session: {user: {id: 'teacher-a'}}, allResponses: [],
    $: id => fields.get(id), applyAnalysisMonth: () => {renders++;},
    renderStudentDetail: () => {renders++;},
    refreshGovernance: async () => {}, refreshSignalReviews: async () => {},
    updateMonthSelector: () => {}, showToast: () => {},
  });
  vm.runInContext('function getTeacherSession(){return session} function studentDetailRoster(){return classSettings.students}', context);
  vm.runInContext(block('let teacherContextEpoch', 'const defaultSettings'), context);
  vm.runInContext(block('function selectStudentDetail(', 'function moveStudentDetail('), context);
  vm.runInContext(block('async function refreshResponses(', 'function showToast('), context);
  return {context, fields, renders: () => renders};
}
test('월 선택은 두 화면을 동기화하고 잘못된 월은 거절한다', () => {
  const {context, fields, renders} = harness();
  assert.equal(context.selectAnalysisMonth('2026-09'), true);
  assert.equal(fields.get('#analysisMonth').value, '2026-09');
  assert.equal(fields.get('#surveyMonth').value, '2026-09');
  assert.equal(context.selectAnalysisMonth('2026-13'), false);
  assert.equal(context.selectedAnalysisMonth, '2026-09');
  assert.equal(renders(), 1);
});
test('학생 선택은 탭 유지·바로가기 탭 지정·미등록 번호 해제를 공통 처리한다', () => {
  const {context, fields} = harness();
  context.selectStudentDetail(2);
  assert.equal(fields.get('#studentDetailSelect').value, '2');
  assert.equal(context.activeStudentDetailTab, 'trend');
  context.selectStudentDetail(1, 'summary');
  assert.equal(context.activeStudentDetailTab, 'summary');
  assert.equal(fields.get('#printStudentReport').disabled, false);
  context.selectStudentDetail(999);
  assert.equal(fields.get('#studentDetailSelect').value, '');
  assert.equal(fields.get('#printStudentReport').disabled, true);
});
test('계정 초기화는 학생·탭을 초기화하고 이전 요청의 유효성을 폐기한다', () => {
  const {context, fields} = harness();
  context.selectStudentDetail(2);
  const valid = context.captureTeacherContext();
  assert.equal(valid(), true);
  context.resetViewSelection();
  assert.equal(valid(), false);
  assert.equal(fields.get('#studentDetailSelect').value, '');
  assert.equal(context.activeStudentDetailTab, 'summary');
});
test('로그아웃 뒤 늦게 도착한 응답은 저장하거나 렌더링하지 않는다', async () => {
  const {context, renders} = harness();
  let resolve;
  context.teacherRpc = () => new Promise(done => {resolve = done;});
  const pending = context.refreshResponses(false);
  context.resetViewSelection();
  context.session = null;
  resolve([{student_number: 1}]);
  await pending;
  assert.equal(context.allResponses.length, 0);
  assert.equal(renders(), 0);
});
test('교사 또는 학급이 바뀌면 이전 요청의 컨텍스트를 거절한다', () => {
  const {context} = harness();
  const validTeacher = context.captureTeacherContext();
  context.session = {user: {id: 'teacher-b'}};
  assert.equal(validTeacher(), false);
  const validClass = context.captureTeacherContext();
  context.classSettings = {...context.classSettings, classId: 'b'};
  assert.equal(validClass(), false);
});
test('겹친 새로고침에서는 마지막 요청 결과만 반영한다', async () => {
  const {context, renders} = harness();
  const pending = [];
  context.teacherRpc = () => new Promise(done => pending.push(done));
  const first = context.refreshResponses(false), second = context.refreshResponses(false);
  pending[1]([{student_number: 2}]);
  await second;
  pending[0]([{student_number: 1}]);
  await first;
  assert.equal(context.allResponses[0].student_number, 2);
  assert.equal(renders(), 1);
});
