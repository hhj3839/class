const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {create} = require('../ai-analysis-controller.js');

function harness() {
  const nodes = new Map(), calls = [], renders = [], notices = [];
  const state = {session: true, key: '', confirm: true, confirms: 0, current: true};
  const dependencies = {
    $: id => {
      if (!nodes.has(id)) nodes.set(id, {disabled: false, textContent: '원래 버튼', innerHTML: '',
        showModal() {state.loginOpened = true;}});
      return nodes.get(id);
    },
    getSettings: () => ({classId: 'fixture'}), getMonth: () => '2026-10',
    getResponses: () => [{month: '2026-10'}], monthOf: row => row.month,
    getAutoKey: () => state.key, setAutoKey: value => {state.key = value;},
    getTeacherSession: () => state.session,
    captureAnalysisRequest: () => () => state.current,
    teacherEdgeFunction: async (name, body) => {calls.push({name, body}); return {meta: {cached: true}};},
    uiConfirm: async () => {state.confirms++; return state.confirm;},
    showToast: value => notices.push(value),
    renderAiAnalysis: value => renders.push(value), renderRelationshipAiAnalysis: value => renders.push(value),
    relationshipAnalysisMonth: () => '2026-09', monthLabel: value => value,
    escapeHTML: value => value.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  };
  return {state, nodes, calls, renders, notices, dependencies, controller: create(dependencies)};
}

test('비로그인 수동 요청은 로그인 안내만 표시하고 AI를 호출하지 않는다', async () => {
  const {state, calls, controller} = harness(); state.session = false;
  await controller.runAiAnalysis(); await controller.runRelationshipAiAnalysis(); await controller.ensureAiAnalysis();
  assert.equal(state.loginOpened, true); assert.equal(calls.length, 0);
});

test('자동 조회는 저장 결과만 요청하며 동일 키 조회를 반복하지 않는다', async () => {
  const {controller, calls, state} = harness();
  await controller.ensureAiAnalysis(); await controller.ensureAiAnalysis();
  assert.equal(calls.length, 1); assert.equal(calls[0].body.force, false);
  assert.equal(state.confirms, 0); assert.equal(state.key, 'fixture:2026-10');
});

test('새 분석 취소는 학급과 관계 모두 API 호출과 버튼 변경 없이 종료한다', async () => {
  const {state, controller, calls, nodes} = harness(); state.confirm = false;
  await controller.runAiAnalysis(true); await controller.runRelationshipAiAnalysis(true);
  assert.equal(calls.length, 0); assert.equal(state.confirms, 2);
  assert.ok([...nodes.values()].every(node => !node.disabled));
});

test('관계 새 분석은 관계 전용 월·종류를 전송하고 버튼을 복구한다', async () => {
  const {controller, calls, nodes, state} = harness();
  await controller.runRelationshipAiAnalysis(true);
  assert.deepEqual(calls[0].body, {classId: 'fixture', month: '2026-09', analysisType: 'relationship', force: true});
  assert.equal(state.confirms, 1);
  assert.equal(nodes.get('#rerunRelationshipAi').textContent, '원래 버튼');
  assert.equal(nodes.get('#runRelationshipAi').disabled, false);
});

test('진행 중 중복 클릭은 차단하고 실패해도 버튼 상태를 복구한다', async () => {
  const h = harness(); let reject, count = 0;
  h.dependencies.teacherEdgeFunction = () => {count++; return new Promise((_, fail) => {reject = fail;});};
  const controller = create(h.dependencies), request = controller.runAiAnalysis();
  await controller.runAiAnalysis(); assert.equal(count, 1);
  reject(new Error('가상 오류')); await request;
  assert.ok([...h.nodes.values()].every(node => !node.disabled && node.textContent === '원래 버튼'));
  assert.match(h.notices[0], /가상 오류/);
});

test('자동 조회 오류는 이스케이프하며 캐시 키를 해제해 재시도를 허용한다', async () => {
  const h = harness(); h.dependencies.teacherEdgeFunction = async () => {throw new Error('<script>');};
  await create(h.dependencies).ensureAiAnalysis();
  assert.equal(h.state.key, '');
  assert.match(h.nodes.get('#aiAnalysisContent').innerHTML, /&lt;script&gt;/);
});

test('AI 제어 모듈은 앱보다 먼저 로드된다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const moduleIndex = html.indexOf('src="ai-analysis-controller.js?');
  assert.ok(moduleIndex >= 0 && moduleIndex < html.indexOf('src="app.js?'));
});
