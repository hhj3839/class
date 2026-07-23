const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const core=require('../analysis-core.js');

const read=file=>fs.readFileSync(file,'utf8');
const teacherHtml=read('index.html');
const studentHtml=read('student.html');
const teacherCss=read('styles.css');
const studentAccessibilityCss=read('student-accessibility.css');

test('교사와 학생 화면은 키보드로 본문을 바로 찾을 수 있다',()=>{
  assert.match(teacherHtml,/class="skip-link" href="#teacherMain"/);
  assert.match(teacherHtml,/<main id="teacherMain" tabindex="-1">/);
  assert.match(studentHtml,/class="skip-link" href="#studentMain"/);
  assert.match(studentHtml,/<main class="student-page" id="studentMain" tabindex="-1">/);
});

test('키보드 포커스와 움직임 최소화 설정을 두 화면에서 유지한다',()=>{
  for(const css of [teacherCss,studentAccessibilityCss]){
    assert.match(css,/:focus-visible/);
    assert.match(css,/prefers-reduced-motion:\s*reduce/);
    assert.match(css,/outline:\s*3px solid/);
  }
});

test('35명 12개월 전체 관계 응답 계산은 자동 성능 기준을 통과한다',()=>{
  const responses=[];
  for(let month=1;month<=12;month+=1){
    for(let student=1;student<=35;student+=1){
      responses.push({
        survey_month:`2026-${String(month).padStart(2,'0')}-01`,
        student_number:student,
        submitted_at:`2026-${String(month).padStart(2,'0')}-15T00:00:00Z`,
        payload_json:{relationships:Array.from({length:34},(_,index)=>{
          const target=index+1>=student?index+2:index+1;
          return{targetNumber:target,score:(student+target+month)%5+1};
        })}
      });
    }
  }
  const started=performance.now();
  const result=core.cumulativeScores(responses);
  const elapsed=performance.now()-started;
  assert.equal(result.latest.size,420);
  assert.equal(result.scores.size,1190);
  assert.ok(elapsed<1500,`관계 계산 ${elapsed.toFixed(1)}ms가 자동 기준 1500ms를 초과했습니다.`);
});

test('학교 운영 절차와 현장 결과지는 개인정보 제외·중단·복구 판단을 포함한다',()=>{
  const runbook=read('SCHOOL_OPERATIONS_RUNBOOK.md');
  const results=read('FIELD_PILOT_RESULTS_v1.2.1.md');
  assert.match(runbook,/즉시 중단하고 P0/);
  assert.match(runbook,/운영 학급이 아닌 별도 시험 학급/);
  assert.match(runbook,/학생 이름, 응답 내용, 교사 이메일, 학급 ID, 참여 토큰/);
  assert.match(results,/시험 계정 사전 리허설 D-01~D-06/);
  assert.match(results,/학생 태블릿 S-01~S-09/);
  assert.match(results,/담임 화면 T-01~T-10/);
  assert.match(results,/PDF·인쇄 P-01~P-06/);
  assert.match(results,/최종 판정: `통과 \/ 조건부 통과 \/ 재시험 필요`/);
});
