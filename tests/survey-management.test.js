const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {create} = require('../survey-management.js');
const enrollment = require('../enrollment-core.js');

function setup() {
  const nodes = new Map(), events = [], notices = [];
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {
        textContent: '', innerHTML: '', dataset: {}, style: {},
        addEventListener: (type, callback) => events.push({selector, type, callback})
      });
      return nodes.get(selector);
    },
    querySelectorAll: () => [],
    addEventListener: (type, callback) => events.push({selector: 'document', type, callback})
  };
  const state = {
    month: '2026-10', rows: [],
    settings: {students: [{number: 1, name: '<학생1>'}, {number: 2, name: '학생2'}]}
  };
  const view = create({
    document, location: {href: 'https://example.invalid/class/'}, navigator: {},
    getSettings: () => state.settings, getMonth: () => state.month,
    getResponses: () => state.rows,
    monthOf: row => row.survey_month.slice(0, 7), payloadOf: row => row.payload_json || {},
    monthLabel: month => month,
    escapeHTML: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    enrollment, qrcode: () => ({addData() {}, make() {}, createImgTag: () => '<img alt="QR">'}),
    selectAnalysisMonth: month => {state.month = month; return true;},
    refreshResponses() {}, showToast(message) {notices.push(message);}
  });
  return {view, state, nodes, events, document, notices};
}

test('설문 모듈은 분석 제외·중복 제출을 학생 단위로 집계하고 이름을 이스케이프한다', () => {
  const {view, state, nodes} = setup();
  state.rows = [
    {survey_month: '2026-10-01', student_number: 1, analysis_excluded: true},
    {survey_month: '2026-10-01', student_number: 1},
    {survey_month: '2026-10-01', student_number: 2}
  ];
  view.renderResponses(state.rows);
  view.normalizeParticipationLabel();
  assert.equal(nodes.get('#surveyParticipation').textContent, '2 / 2명');
  assert.match(nodes.get('#monthlySurveyAccordion').innerHTML, /2\/2명/);
  assert.match(nodes.get('#studentGrid').innerHTML, /&lt;학생1&gt;/);
  assert.equal(nodes.get('#responseList').innerHTML, '');
});

test('전출 집계 제외 기록은 재제출로 세지 않고 실제 중복만 센다', () => {
  const {view, state, nodes} = setup();
  state.settings.students[1].transferredOn = '2026-09-01';
  const rows = [1, 2].map(student_number => ({student_number, survey_month:'2026-10-01'}));
  view.renderResponses(rows);
  assert.match(nodes.get('#surveyParticipation').textContent, /1 \/ 1명/);
  assert.doesNotMatch(nodes.get('#monthlySurveyAccordion').innerHTML, /다시 제출한 기록/);
  view.renderResponses([...rows, rows[1]]);
  assert.match(nodes.get('#monthlySurveyAccordion').innerHTML, /다시 제출한 기록 1건/);
});

test('설문 모듈은 계정 변경 후 최신 학급과 월을 전달받아 렌더링한다', () => {
  const {view, state, nodes} = setup();
  state.settings = {students: [{number: 3, name: '새 학급'}], participationToken: 'fixture-token'};
  state.month = '2026-09';
  view.renderResponses([{survey_month: '2026-09-01', student_number: 3}]);
  view.renderParticipationLink();
  assert.match(nodes.get('#studentGrid').innerHTML, /새 학급/);
  assert.match(nodes.get('#surveyParticipation').textContent, /1 \/ 1명.*2026-09/);
  assert.equal(nodes.get('#copyLink').dataset.link, 'https://example.invalid/class/student.html?join=fixture-token');
  state.settings = {students: []};
  view.renderParticipationLink();
  assert.equal(nodes.get('#copyLink').dataset.link, '');
});

test('설문 이벤트는 한 번만 연결하고 공통 월 선택 함수를 호출한다', () => {
  const {view, state, events} = setup();
  view.bindEvents();
  const count = events.length;
  view.bindEvents();
  assert.equal(events.length, count);
  events.find(event => event.selector === '#surveyMonth').callback({target: {value: '2026-08'}});
  assert.equal(state.month, '2026-08');
});

test('설문 모듈은 앱보다 먼저 로드되며 앱 상태는 명시적 접근자로 전달한다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('src="survey-management.js') < html.indexOf('src="app.js'));
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /IeumSurveyManagement\.create/);
  assert.doesNotMatch(app, /function renderResponses\(responses\)\{const month=/);
});

test('QR 저장은 원본 크기를 유지해 PNG로 인코딩한다', () => {
  const h = setup(); h.view.bindEvents();
  h.state.settings = {...h.state.settings, grade: 3, classNumber: 1};
  const image = {complete: true, naturalWidth: 241, naturalHeight: 241, src: 'data:image/gif;base64,fixture'};
  h.nodes.set('#participationQr img', image);
  const drawing = [], canvas = {getContext: () => ({drawImage: (...args) => drawing.push(args)}),
    toDataURL: type => {assert.equal(type, 'image/png'); return 'data:image/png;base64,fixture';}};
  let clicks = 0; const link = {click() {clicks++;}};
  h.document.createElement = tag => tag === 'canvas' ? canvas : link;
  h.events.find(event => event.selector === '#downloadQr').callback();
  assert.equal(canvas.width, 241); assert.equal(canvas.height, 241);
  assert.deepEqual(drawing, [[image, 0, 0]]);
  assert.equal(link.href, 'data:image/png;base64,fixture');
  assert.equal(link.download, '우리반이음-3-1-참여QR.png');
  assert.equal(clicks, 1);
});

test('QR 미준비와 미존재는 다운로드 없이 안내한다', () => {
  const h = setup(); h.view.bindEvents();
  const click = h.events.find(event => event.selector === '#downloadQr').callback;
  h.nodes.set('#participationQr img', {complete: false, naturalWidth: 0}); click();
  assert.match(h.notices.at(-1), /QR 준비 중/);
  h.nodes.set('#participationQr img', null); click();
  assert.match(h.notices.at(-1), /QR 코드가 없습니다/);
});

test('PNG 변환 실패는 잘못된 파일을 저장하지 않고 안내한다', () => {
  const h = setup(); h.view.bindEvents();
  h.nodes.set('#participationQr img', {complete: true, naturalWidth: 241, naturalHeight: 241});
  h.document.createElement = () => ({getContext: () => null});
  h.events.find(event => event.selector === '#downloadQr').callback();
  assert.match(h.notices.at(-1), /QR 저장 실패/);
});
