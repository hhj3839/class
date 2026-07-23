const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const checklist=fs.readFileSync('FIELD_PILOT_v1.2.1.md','utf8');
const issue=fs.readFileSync('FIELD_ISSUE_TEMPLATE.md','utf8');
const studentGuide=fs.readFileSync('STUDENT_SURVEY_GUIDE.md','utf8');
const teacherGuide=fs.readFileSync('TEACHER_QUICK_GUIDE.md','utf8');
const prd=fs.readFileSync('PRD_v1.2.md','utf8');

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

test('학생 안내문은 참여·제출·연결 오류·긴급 도움 원칙을 설명한다',()=>{
  assert.match(studentGuide,/내 이름을 선택하세요/);
  assert.match(studentGuide,/응답 제출하기/);
  assert.match(studentGuide,/탭을 닫지 않습니다/);
  assert.match(studentGuide,/가까운 선생님이나 믿을 수 있는 어른/);
  assert.match(studentGuide,/학생 이름이나 작성한 답이 보이는 화면/);
});

test('담임 운영 가이드는 준비부터 종료까지 현장 대응 흐름을 제공한다',()=>{
  for(const heading of ['수업 전 준비','학생 참여 진행','제출 후 살펴보기','문제가 생겼을 때','종료 전 확인'])assert.match(teacherGuide,new RegExp(heading));
  assert.match(teacherGuide,/\?join=/);
  assert.match(teacherGuide,/P0 오류/);
  assert.match(teacherGuide,/학생 보호·보고 절차를 우선/);
  assert.match(teacherGuide,/로그아웃한 뒤 뒤로 가기·새로고침/);
});

test('PRD 현재 기준선은 최신 교사 UI와 파일럿 안정성 범위를 요약한다',()=>{
  assert.match(prd,/이번 달 우리 반에서 보이는 흐름/);
  assert.match(prd,/현재 활성 명단 중심 AI 분석과 이전 명단 학생 표시/);
  assert.match(prd,/35명·12개월 관계 계산 성능 검사/);
  assert.match(prd,/학교 장애 대응·백업·복구 절차/);
});
