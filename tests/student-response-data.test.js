const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {create} = require('../student-response-data.js');
const source = fs.readFileSync('app.js', 'utf8');
const monthOf = row => row.survey_month.slice(0, 7);
const payloadOf = row => row.payload_json || {};
const context = vm.createContext({monthOf, payloadOf});
vm.runInContext(source.slice(source.indexOf('function latestByStudent('), source.indexOf('function quoted(')), context);
function setup() {
  const state = {students: [{number: 1, name: '이음'}, {number: 2, name: '김이음'}, {number: 3, name: '가상'}], rows: []};
  const api = create({getSettings: () => state, getResponses: () => state.rows,
    monthOf, payloadOf, monthLabel: month => month, latestByStudent: context.latestByStudent});
  return {state, api};
}
function row(month, number, payload = {}, extra = {}) {
  return {survey_month: `${month}-01`, student_number: number, submitted_at: `${month}-02T00:00:00Z`, payload_json: payload, ...extra};
}
test('월별 계산은 최신 유효 제출을 사용하고 미참여 월을 만들지 않는다', () => {
  const {state, api} = setup();
  state.rows = [row('2026-06', 1), row('2026-06', 1, {}, {id: 'latest', submitted_at: '2026-06-03T00:00:00Z'}), row('2026-07', 1, {}, {analysis_excluded: true}), row('2026-08', 2)];
  const before = JSON.stringify(state.rows);
  const result = api.studentMonthlyResponses(1);
  assert.equal(result.length, 1);
  assert.equal(result[0].item.id, 'latest');
  assert.equal(JSON.stringify(state.rows), before);
});
test('받은 관계 점수는 상대→본인 방향만 계산하며 자기 응답은 제외한다', () => {
  const {state, api} = setup();
  state.rows = [row('2026-09', 1, {relationships: [{targetNumber: 1, score: 1}, {targetNumber: 2, score: 1}]}), row('2026-09', 2, {relationships: [{targetNumber: 1, score: 5}]}), row('2026-09', 3, {relationships: [{targetNumber: 1, score: 3}]})];
  assert.deepEqual(api.incomingRelationshipFor(1, '2026-09'), {average: 4, count: 2});
  assert.equal(api.incomingRelationshipFor(1, '2026-08'), null);
});
test('번호 선택을 우선하고 긴 이름에 포함된 짧은 이름은 잘못 집계하지 않는다', () => {
  const {state, api} = setup();
  assert.equal(api.mentionsStudentName('김이음이 도와줌', state.students[0]), false);
  state.rows = [row('2026-09', 3, {peerObservations: {kind: {studentNumbers: [1], detail: '김이음'}, growth: {detail: '김이음이 도와줌'}}})];
  assert.equal(api.receivedPositiveMentions(state.students[0], '2026-09').length, 1);
  assert.equal(api.receivedPositiveMentions(state.students[1], '2026-09').length, 1);
});
test('3회 응답이 있어야 반복 패턴을 만들고 학급 교체 후 이전 응답을 재사용하지 않는다', () => {
  const {state, api} = setup();
  state.rows = ['2026-06', '2026-07', '2026-08'].flatMap(month => [row(month, 1), row(month, 2, {relationships: [{targetNumber: 1, score: 4}]})]);
  const monthly = api.studentMonthlyResponses(1);
  assert.equal(api.studentResponseInsights(state.students[0], monthly.slice(0, 2)).patterns.length, 0);
  assert.equal(api.studentResponseInsights(state.students[0], monthly).patterns.length, 1);
  state.rows = [];
  assert.equal(api.studentMonthlyResponses(1).length, 0);
});
