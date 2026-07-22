const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const checklist=fs.readFileSync('FIELD_PILOT_v1.2.1.md','utf8');
const issue=fs.readFileSync('FIELD_ISSUE_TEMPLATE.md','utf8');

test('현장 점검표는 태블릿·교사 화면·PDF·권한·복구 시험을 포함한다',()=>{
  for(const id of ['S-01','S-09','T-01','T-08','P-01','P-06','A-01','A-04'])assert.match(checklist,new RegExp(id));
  assert.match(checklist,/P0 오류 0건/);
  assert.match(checklist,/v1\.2\.1-rc\.1/);
});

test('오류 기록 양식은 개인정보 제외와 심각도·재현·재시험 정보를 요구한다',()=>{
  assert.match(issue,/학생 이름, 설문 원문/);
  assert.match(issue,/P0 \/ P1 \/ P2/);
  assert.match(issue,/재현 횟수/);
  assert.match(issue,/수정 PR/);
  assert.match(issue,/재시험 결과/);
});
