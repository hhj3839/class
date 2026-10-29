const test = require('node:test');
const assert = require('node:assert/strict');
const {create} = require('../report-content.js');
const escapeHTML = value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function setup() {
  const state = {settings: {schoolYear: 2026, students: [{number: 1, name: '<가상>'}]}, rows: [], ai: null};
  const api = create({getSettings: () => state.settings, getResponses: () => state.rows, getAiAnalysis: () => state.ai,
    escapeHTML, aiTeacherDisplayText: text => text.replace('학생-1', '<가상>'), conciseAiSentence: text => text,
    studentObservationSentence: () => '', cleanAiEvidenceText: text => text,
    classMonthlyTrend: () => [], monthLabel: text => text, yearEndClassLabel: () => '가상 학급',
    buildStudentOverviewReportSection: () => '<p>요약</p>', buildStudentMonthlyResponseReportSection: () => '<p>월별 응답</p>'});
  return {state, api};
}
test('학급 AI 보고서는 저장 결과를 사용하고 학생 범위와 HTML 이스케이프를 유지한다', () => {
  const {state, api} = setup();
  state.ai = {analysis: {summary: '<요약>', priority_students: [1, 2].map(number => ({student: `학생-${number}`, priority: '확인', attention_reason: '<근거>'}))}};
  const named = api.buildAiReportSection('student', 1, true);
  assert.match(named, /&lt;가상&gt;/);
  assert.doesNotMatch(named, /학생-2|<근거>/);
  const anonymous = api.buildAiReportSection('class', 0, false);
  assert.match(anonymous, /학생-1/);
  assert.doesNotMatch(anonymous, /가상/);
});
test('학년 말 본문은 AI 없이 학생 요약·월별 응답을 포함하고 최신 학급을 사용한다', () => {
  const {state, api} = setup();
  const html = api.yearEndReportContent();
  assert.match(html, /&lt;가상&gt;/);
  assert.match(html, /요약/);
  assert.match(html, /월별 응답/);
  state.settings = {schoolYear: 2025, students: []};
  const empty = api.yearEndReportContent();
  assert.match(empty, /2025학년도/);
  assert.match(empty, /등록된 학생 자료가 없습니다/);
  assert.doesNotMatch(empty, /&lt;가상&gt;/);
});
