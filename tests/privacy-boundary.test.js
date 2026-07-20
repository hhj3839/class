const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('교사용 앱은 로그인 전 숨겨지고 전용 로그인 게이트만 표시된다',()=>{
  const html=read('index.html');
  const css=read('analysis-dashboard.css');
  assert.match(html,/id="authGate"/);
  assert.match(html,/id="teacherApp" hidden/);
  assert.match(css,/\[hidden\]\{display:none!important\}/);
});

test('교사용 개인정보를 localStorage에 저장하지 않는다',()=>{
  const app=read('app.js');
  assert.doesNotMatch(app,/localStorage\.setItem/);
  assert.match(app,/localStorage\.removeItem\('ieum-class-settings'\)/);
  assert.match(app,/localStorage\.removeItem\('ieum-observations'\)/);
});

test('학생 설문은 교사용 브라우저 저장공간에 의존하지 않는다',()=>{
  const student=read('student.js');
  assert.doesNotMatch(student,/localStorage|ieum-class-settings|ieum-observations/);
  assert.match(student,/params\.get\('join'\)\|\|''/);
  assert.match(student,/sessionStorage/);
});

test('계정 전환과 학급 없는 계정 진입 시 이전 교사의 민감 패널을 즉시 비운다',()=>{
  const app=read('app.js');
  assert.match(app,/currentAiRun=null/);
  assert.match(app,/\$\('#aiAnalysisPanel'\)\.hidden=true/);
  assert.match(app,/\$\('#aiAnalysisContent'\)\.innerHTML=/);
  assert.match(app,/\$\('#auditLogList'\)\.innerHTML=/);
  assert.match(app,/\$\('#participationQr'\)\.replaceChildren\(\)/);
  assert.match(app,/if\(!classes\.length\)\{clearSensitiveState\(\)/);
});

test('소스 기본값에 실제 교사 이름과 운영 학급 ID가 없다',()=>{
  const source=read('app.js')+read('index.html')+read('student.js');
  assert.doesNotMatch(source,/홍현진|2026-5-2|김하린/);
});

test('회원가입 교사는 권한 함수로 본인 소유의 첫 학급만 생성한다',()=>{
  const migration=read('supabase/migrations/20260720230000_teacher_self_service_class.sql');
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/teacher_id,teacher_name/);
  assert.match(migration,/grant execute on function public\.teacher_create_class_auth/);
});
