const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');

function harness() {
  const nodes = new Map(), pending = [], rendered = [], notices = [];
  const context = vm.createContext({
    selectedAnalysisMonth: '2026-09', activeStudentDetailTab: 'summary',
    classSettings: {classId: 'a', students: []}, defaultSettings: {},
    session: {user: {id: 'teacher-a'}}, aiAutoKey: '',
    allResponses: [{month: '2026-09'}, {month: '2026-10'}],
    $: id => {
      if (!nodes.has(id)) nodes.set(id, {textContent: '', innerHTML: '', disabled: false,
        replaceChildren() {this.innerHTML = '';}, click() {}, showModal() {}});
      return nodes.get(id);
    },
    getTeacherSession: () => context.session,
    monthOf: row => row.month, monthLabel: value => value,
    relationshipAnalysisMonth: () => context.selectedAnalysisMonth,
    escapeHTML: value => value, uiConfirm: async () => true,
    teacherEdgeFunction: (name, body) => new Promise((resolve, reject) => pending.push({name, body, resolve, reject})),
    teacherRpc: (name, body) => new Promise((resolve, reject) => pending.push({name, body, resolve, reject})),
    renderAiAnalysis: result => rendered.push(result),
    renderRelationshipAiAnalysis: result => rendered.push(result),
    showToast: message => notices.push(message),
    renderClassIdentity() {}, renderSettings() {}, renderParticipationLink() {},
    renderStudentDetailSelector() {}, refreshResponses: async () => {}, refreshPilotReadiness: async () => {},
    renderAuthState() {}, applyAnalysisMonth() {}, clearStudentCoachingState() {}, clearEnrollmentDialog() {},
    persistClassSettings() {}, renderStudents() {}, renderStudentDetail() {},
    loadClassSettings: () => ({classId: '', students: []}),
  });
  vm.runInContext(source.slice(source.indexOf('let teacherContextEpoch'), source.indexOf('const defaultSettings')), context);
  context.IeumAiAnalysisController = require('../ai-analysis-controller.js');
  vm.runInContext(source.slice(source.indexOf('const aiAnalysisController ='), source.indexOf('const studentResponseData =')), context);
  for (const name of ['runAiAnalysis', 'ensureAiAnalysis', 'runRelationshipAiAnalysis', 'loadTeacherContext', 'clearSensitiveState']) {
    vm.runInContext(source.split(/\r?\n/).find(line => line.startsWith(`async function ${name}(`) || line.startsWith(`function ${name}(`)), context);
  }
  return {context, pending, rendered, nodes, notices};
}

test('AI 자동 조회: 이전 월의 늦은 성공은 최신 월을 덮지 않는다', async () => {
  const {context, pending, rendered} = harness();
  const first = context.ensureAiAnalysis();
  context.selectAnalysisMonth('2026-10', false);
  const second = context.ensureAiAnalysis();
  pending[1].resolve({month: '2026-10'}); await second;
  pending[0].resolve({month: '2026-09'}); await first;
  assert.deepEqual(rendered, [{month: '2026-10'}]);
});

test('AI 자동 조회: 이전 월의 늦은 오류는 새 결과와 캐시 키를 바꾸지 않는다', async () => {
  const {context, pending, nodes} = harness();
  const first = context.ensureAiAnalysis();
  context.selectAnalysisMonth('2026-10', false);
  const second = context.ensureAiAnalysis();
  pending[1].resolve({month: '2026-10'}); await second;
  pending[0].reject(new Error('old error')); await first;
  assert.equal(context.aiAutoKey, 'a:2026-10');
  assert.doesNotMatch(nodes.get('#aiAnalysisContent').innerHTML, /old error/);
});

test('같은 월로 돌아오거나 수동 조회가 겹쳐도 마지막 요청만 반영한다', async () => {
  const {context, pending, rendered} = harness();
  const first = context.ensureAiAnalysis();
  context.selectAnalysisMonth('2026-10', false);
  context.selectAnalysisMonth('2026-09', false);
  const second = context.runAiAnalysis(false);
  pending[1].resolve({id: 'new'}); await second;
  pending[0].resolve({id: 'old'}); await first;
  assert.deepEqual(rendered, [{id: 'new'}]);
});

for (const method of ['ensureAiAnalysis', 'runAiAnalysis', 'runRelationshipAiAnalysis']) {
  test(`${method}: 로그아웃 이후 결과·오류 알림 차단`, async () => {
    const {context, pending, rendered, notices} = harness();
    const request = context[method](false);
    context.resetViewSelection(); context.session = null;
    pending[0].resolve({id: 'old-account'}); await request;
    assert.equal(rendered.length, 0);
    assert.equal(notices.length, 0);
  });
}

test('확인창 중 계정 변경은 유료 AI 호출 전에 중단한다', async () => {
  const {context, pending} = harness();
  let confirm;
  context.uiConfirm = () => new Promise(resolve => {confirm = resolve;});
  const request = context.runAiAnalysis(true);
  context.session = {user: {id: 'teacher-b'}};
  confirm(true); await request;
  assert.equal(pending.length, 0);
});

test('학급 목록 조회 중 로그아웃하면 학급 상세를 요청하지 않는다', async () => {
  const {context, pending} = harness();
  const request = context.loadTeacherContext();
  context.resetViewSelection(); context.session = null;
  pending[0].resolve([{class_id: 'old-class'}]); await request;
  assert.equal(pending.length, 1);
  assert.equal(context.classSettings.classId, 'a');
});

test('학급 상세 조회 중 계정 변경은 이전 학급 반영을 차단한다', async () => {
  const {context, pending} = harness();
  const request = context.loadTeacherContext();
  pending[0].resolve([{class_id: 'old-class'}]); await new Promise(setImmediate);
  context.session = {user: {id: 'teacher-b'}};
  pending[1].resolve({classId: 'old-class', students: [{number: 1, name: '가상'}]});
  await request;
  assert.equal(context.classSettings.classId, 'a');
});

test('겹친 학급 초기화에서 이전 목록 결과를 폐기한다', async () => {
  const {context, pending} = harness();
  const first = context.loadTeacherContext(), second = context.loadTeacherContext();
  pending[1].resolve([{class_id: 'new-class'}]); await new Promise(setImmediate);
  pending[2].resolve({classId: 'new-class', students: []}); await second;
  pending[0].resolve([{class_id: 'old-class'}]); await first;
  assert.equal(context.classSettings.classId, 'new-class');
  assert.equal(pending.length, 3);
});

test('민감 상태 초기화는 관계 AI 메모리와 화면 원문도 삭제한다', () => {
  const {context} = harness();
  context.currentRelationshipAiAnalysis = {analysis: '가상 민감 결과'};
  const content = context.$('#relationshipAiContent'); content.innerHTML = '이전 결과';
  context.clearSensitiveState();
  assert.equal(context.currentRelationshipAiAnalysis, null);
  assert.equal(content.innerHTML, '');
  assert.equal(context.$('#relationshipAiMeta').textContent, '마지막 분석 확인 전');
});
