const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {create} = require('../student-detail-view.js');

test('학생 미선택 시 빈 화면과 비활성 탭을 유지한다', () => {
  const nodes = {'#studentDetailSelect': {value: ''}, '#studentDetailContent': {innerHTML: ''}};
  const tabs = [{disabled: false}];
  const view = create({document: {querySelector: id => nodes[id], querySelectorAll: () => tabs},
    getSettings: () => ({students: []}), getReviews: () => [], getActiveTab: () => 'summary', studentDetailRoster: () => []});
  view.renderStudentDetail();
  assert.match(nodes['#studentDetailContent'].innerHTML, /학생 선택/);
  assert.equal(tabs[0].disabled, true);
});

test('응답 없는 학생도 학년도 흐름과 선택한 탭을 유지한다', () => {
  const nodes = {'#studentDetailSelect': {value: '1'}, '#studentDetailContent': {innerHTML: ''}};
  let active;
  const view = create({document: {querySelector: id => nodes[id], querySelectorAll: () => []},
    getSettings: () => ({students: [{number: 1}]}), getReviews: () => [], getActiveTab: () => 'trend',
    studentDetailRoster: () => [{number: 1}], studentMonthlyResponses: () => [],
    studentYearTimelineHTML: () => '<p>학년도 흐름</p>', renderStudentCoachingShell() {},
    setStudentDetailTab: tab => {active = tab;}});
  view.renderStudentDetail();
  assert.match(nodes['#studentDetailContent'].innerHTML, /제출된 설문 없음/);
  assert.match(nodes['#studentDetailContent'].innerHTML, /학년도 흐름/);
  assert.equal(active, 'trend');
});

test('학생 상세·PDF 모듈은 앱보다 먼저 로드된다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const name of ['student-detail-view.js', 'pdf-download.js']) {
    assert.ok(html.indexOf(`src="${name}`) >= 0);
    assert.ok(html.indexOf(`src="${name}`) < html.indexOf('src="app.js'));
  }
});
