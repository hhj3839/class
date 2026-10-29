const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {create} = require('../teacher-context-loader.js');

function harness() {
  const calls = [], events = [], notices = [];
  const state = {session: true, valid: true, classes: [{class_id: 'fixture'}],
    context: {classId: 'fixture', students: [{number: '1', name: '가상', student_id: 'a', transferred_on: '2026-09-12'}]}};
  const dependencies = {
    getTeacherSession: () => state.session,
    captureTeacherContext: () => () => state.valid,
    teacherRpc: async (name, params) => {
      calls.push({name, params});
      if (name === 'teacher_get_my_classes') return state.classes;
      if (name === 'teacher_roll_demo_months_forward_auth') {
        if (state.failDemo) throw new Error('가상 실패');
        return true;
      }
      return state.context;
    },
    getDefaults: () => ({grade: 1}), setSettings: value => {state.settings = value;},
    clearSensitiveState: () => events.push('clear'), renderAuthState: () => events.push('auth'),
    openSettings: () => events.push('settings'), renderContext: () => events.push('render'),
    refreshResponses: async notice => events.push(`responses:${notice}`),
    refreshPilotReadiness: async () => events.push('readiness'),
    showToast: value => notices.push(value), warn: () => events.push('warn'),
  };
  return {state, calls, events, notices, dependencies, loader: create(dependencies)};
}

test('비로그인은 학급 RPC를 호출하지 않는다', async () => {
  const h = harness(); h.state.session = false;
  await h.loader.loadTeacherContext(); assert.equal(h.calls.length, 0);
});

test('학급이 없으면 민감 자료를 비우고 설정으로 연결한다', async () => {
  const h = harness(); h.state.classes = [];
  await h.loader.loadTeacherContext();
  assert.deepEqual(h.events, ['clear', 'auth', 'settings']);
  assert.equal(h.calls.length, 1); assert.match(h.notices[0], /새 학급/);
});

test('명단 정규화 후 화면·응답·준비 상태를 순서대로 갱신한다', async () => {
  const h = harness(), original = JSON.stringify(h.state.context);
  await h.loader.loadTeacherContext();
  assert.deepEqual(h.state.settings.students, [{number: 1, name: '가상', studentId: 'a', transferredOn: '2026-09-12'}]);
  assert.equal(h.state.settings.grade, 1);
  assert.equal(JSON.stringify(h.state.context), original);
  assert.deepEqual(h.events, ['render', 'responses:false', 'readiness']);
  assert.equal(h.calls.length, 2);
});

test('실험실만 월 갱신을 호출하고 실패해도 학급을 불러온다', async () => {
  const h = harness(); h.state.classes = [{class_id: 'demo-fixture'}]; h.state.failDemo = true;
  await h.loader.loadTeacherContext();
  assert.deepEqual(h.calls.map(item => item.name), ['teacher_get_my_classes', 'teacher_roll_demo_months_forward_auth', 'teacher_get_class_context_auth']);
  assert.equal(h.events[0], 'warn'); assert.ok(h.state.settings);
});

test('응답 조회 도중 컨텍스트가 바뀌면 준비 상태를 다시 조회하지 않는다', async () => {
  const h = harness(); h.dependencies.refreshResponses = async () => {h.state.valid = false;};
  await create(h.dependencies).loadTeacherContext();
  assert.ok(!h.events.includes('readiness'));
});

test('초기화 오류는 로그인 여부에 따라 안내 또는 초기화한다', async () => {
  const h = harness(); h.dependencies.teacherRpc = async () => {throw new Error('가상 오류');};
  await create(h.dependencies).bootstrapTeacherApp();
  assert.match(h.notices[0], /가상 오류/);
  h.events.length = 0;
  h.dependencies.teacherRpc = async () => {h.state.session = false; throw new Error('만료');};
  await create(h.dependencies).bootstrapTeacherApp();
  assert.deepEqual(h.events, ['auth', 'clear', 'auth']);
});

test('학급 초기화 모듈은 앱보다 먼저 로드된다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const position = html.indexOf('src="teacher-context-loader.js?');
  assert.ok(position >= 0 && position < html.indexOf('src="app.js?'));
});
