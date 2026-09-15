const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=file=>fs.readFileSync(file,'utf8');
const prd=read('PRD_v1.2.md');
const checklist=read('FIELD_PILOT_v1.2.1.md');
const results=read('FIELD_PILOT_RESULTS_v1.2.1.md');
const runbook=read('SEPTEMBER_FIELD_TEST_RUNBOOK.md');
const aiEval=read('AI_QUALITY_EVAL_v1.2.1.md');
const issue=read('FIELD_ISSUE_TEMPLATE.md');
const pages=read('.github/workflows/pages.yml');

test('9월 현장 기준선은 최신 배포 커밋과 두 운영 주소를 사용한다',()=>{
  for(const document of [checklist,results]) assert.match(document,/`95db728`/); // Historical field records retain their original baseline.
  assert.match(prd,/`6a0b291`/);
  assert.match(checklist,/대상 시기: 2026년 9월/);
  assert.match(results,/2026년 9월 현장 실행 기준선/);
  assert.match(prd,/운영 주소: https:\/\/class-ieum\.vercel\.app\//);
  assert.match(prd,/보조 주소: https:\/\/hhj3839\.github\.io\/class\//);
});

test('30분 현장 실행표는 학생·교사·PDF·권한과 중단 절차를 연결한다',()=>{
  for(const phrase of ['시험 전 5분','학생 흐름 10분','교사 흐름 8분','PDF·권한 5분','종료 2분']) assert.match(runbook,new RegExp(phrase));
  assert.match(runbook,/태블릿 3~5대/);
  assert.match(runbook,/제출 버튼을 빠르게 두 번/);
  assert.match(runbook,/다른 교사 시험 계정/);
  assert.match(runbook,/P0이면 즉시 시험을 중단/);
});

test('자동 검사 결과를 실제 기기 통과로 오인하지 않는다',()=>{
  assert.match(runbook,/자동 검사와 실제 검사의 경계/);
  assert.match(runbook,/자동 검사 통과를 실제 기기 통과로 기록하지 않는다/);
  assert.match(runbook,/화면 잠금/);
  assert.match(runbook,/종이 인쇄/);
});

test('AI 품질 평가는 이름·근거·비단정·간결성·코칭·한국어를 검사한다',()=>{
  for(const criterion of ['이름과 조사','근거 일치','비단정 표현','간결성','코칭 연결','한국어 품질']) assert.match(aiEval,new RegExp(criterion));
  assert.match(aiEval,/비식별 데모 응답 10~20개/);
  assert.match(aiEval,/이름·근거·비단정 기준 실패가 0건/);
});

test('장애 기록과 Pages 배포는 개인정보 없는 진단과 최신 Actions를 사용한다',()=>{
  assert.match(issue,/오류 종류: `로그인 \/ 설문 제출 \/ AI 분석 \/ PDF \/ 권한 \/ 배포 \/ 기타`/);
  assert.match(issue,/화면 종류/);
  assert.match(issue,/실행 상태/);
  assert.match(pages,/actions\/checkout@v5/);
  assert.match(pages,/actions\/configure-pages@v5/);
  assert.match(pages,/actions\/upload-pages-artifact@v4/);
  assert.match(pages,/actions\/deploy-pages@v4/);
});
