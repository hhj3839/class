const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const student=fs.readFileSync('student.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20260720190000_secure_participation_pilot.sql','utf8');

test('학생 공개 진입은 학급 ID 대신 임의 참여 토큰을 사용한다',()=>{
  assert.match(student,/params\.get\('join'\)/);
  assert.match(student,/get_roster_by_token/);
  assert.match(student,/submit_response_by_token/);
  assert.doesNotMatch(student,/params\.get\('class'\)/);
  assert.match(migration,/revoke execute on function public\.get_roster\(text\)/);
});

test('학생 임시 저장은 탭 세션에 한정되고 제출 성공 시 삭제된다',()=>{
  assert.match(student,/sessionStorage\.setItem/);
  assert.match(student,/12\*60\*60\*1000/);
  assert.match(student,/sessionStorage\.removeItem\(draftKey\(\)\)/);
  assert.doesNotMatch(student,/localStorage/);
});

test('QR·토큰 회전·파일럿 점검 UI와 교사 권한 검사가 연결된다',()=>{
  assert.match(html,/id="participationQr"/);
  assert.match(html,/vendor\/qrcode\.js\?v=2\.0\.4/);
  assert.doesNotMatch(html,/cdn\.jsdelivr|unpkg/);
  assert.match(app,/teacher_rotate_participation_token_auth/);
  assert.match(app,/teacher_get_pilot_readiness_auth/);
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
});

test('파일럿 준비 화면은 배포·세션·DB 상태를 한 번에 다시 점검한다',()=>{
  assert.match(html,/id="pilotReadinessSummary"[^>]*role="status"/);
  assert.match(html,/id="refreshPilot"/);
  assert.match(app,/교사 로그인 자동 갱신/);
  assert.match(app,/DB·학급 권한/);
  assert.match(app,/location\.protocol==='https:'/);
  assert.match(app,/\$\('#refreshPilot'\)\.addEventListener/);
  assert.match(app,/Promise\.all\(\[refreshPilotReadiness\(\),refreshPilotMetrics\(\)\]\)/);
});

test('파일럿 점검 결과는 개인정보 없이 내려받는다',()=>{
  assert.match(html,/id="exportPilotReadiness"/);
  assert.match(app,/class-ieum-pilot-readiness-v1/);
  assert.match(app,/학생 이름, 응답 원문, 교사 이메일, 학급 ID와 전체 브라우저 식별정보를 포함하지 않음/);
  assert.match(app,/classSummary:\{schoolYear:/);
  assert.match(app,/downloadJson\(report,/);
  const exportBlock=app.match(/\$\('#exportPilotReadiness'\)[\s\S]*?showToast\('개인정보를 제외한 파일럿 점검 결과를 저장했습니다.'\)\}\);/)?.[0]||'';
  assert.doesNotMatch(exportBlock,/teacherName|student_name|payload_json|classId|authEmail/);
});

test('파일럿 준비 상태는 태블릿 핵심 기능만 비식별 점검한다',()=>{
  assert.match(app,/태블릿 화면 크기/);
  assert.match(app,/임시 저장공간/);
  assert.match(app,/QR·PDF 파일 기능/);
  assert.match(app,/window\.innerWidth>=360/);
  assert.match(app,/document\.createElement\('canvas'\)\.getContext/);
  assert.match(app,/touchCapable:navigator\.maxTouchPoints>0/);
  assert.doesNotMatch(app,/navigator\.userAgent/);
  assert.match(app,/전체 브라우저 식별정보를 포함하지 않음/);
});

test('배포 HTML은 최신 앱·인증·파일럿 스타일 캐시 버전을 사용한다',()=>{
  assert.match(html,/styles\.css\?v=20260722-6/);
  assert.match(html,/pilot-feedback\.css\?v=20260720-3/);
  assert.match(html,/supabase\.js\?v=20260720-4/);
  assert.match(html,/analysis-dashboard\.css\?v=20260723-1/);
  assert.match(html,/app\.js\?v=20260723-2/);
  assert.match(html,/student-support-timeline\.css\?v=20260722-2/);
  assert.match(html,/student-support-timeline\.js\?v=20260722-5/);
  assert.match(html,/student-record\.css\?v=20260722-6/);
  assert.match(fs.readFileSync('student.html','utf8'),/supabase\.js\?v=20260720-4/);
});

test('학생 관계 선택 접근성 문구는 이름 받침에 맞는 조사를 사용한다',()=>{
  assert.match(student,/function relationshipLabel\(name\)/);
  assert.match(student,/\(last-0xac00\)%28!==0/);
  assert.match(student,/hasFinal\?'과':'와'/);
  assert.match(student,/aria-label="\$\{relationshipLabel\(student\.name\)\}"/);
  assert.match(fs.readFileSync('student.html','utf8'),/student\.js\?v=20260722-2/);
});

test('학생 설문의 태블릿 터치 선택 영역은 최소 44px이다',()=>{
  const touchCss=fs.readFileSync('student-touch.css','utf8');
  assert.match(touchCss,/\.help-now label \{[\s\S]*min-height: 44px/);
  assert.match(touchCss,/\.rating-options label \{[\s\S]*min-height: 48px/);
  assert.match(fs.readFileSync('student.html','utf8'),/student-touch\.css\?v=20260720-1/);
});

test('학생 제출은 고유 ID로 네트워크 재시도 중복을 방지한다',()=>{
  const idempotent=fs.readFileSync('supabase/migrations/20260720235960_idempotent_student_submissions.sql','utf8');
  assert.match(student,/let submissionId=crypto\.randomUUID\(\)/);
  assert.match(student,/submissionId=payload\.submissionId\|\|submissionId/);
  assert.match(student,/function submissionPayload\(\)/);
  assert.match(student,/const payload=submissionPayload\(\)/);
  assert.match(idempotent,/add column if not exists submission_id uuid/);
  assert.match(idempotent,/unique index if not exists survey_responses_submission_id_key/);
  assert.match(idempotent,/on conflict\(submission_id\) where submission_id is not null do nothing/);
  assert.match(idempotent,/r\.class_id=target_class and r\.student_id=target_student_id/);
  assert.match(fs.readFileSync('student.html','utf8'),/student\.js\?v=20260722-2/);
});

test('학생 작성 내용은 화면 전환 직전에 저장하고 연결 복구 시 명단을 다시 불러온다',()=>{
  assert.match(student,/visibilitychange/);
  assert.match(student,/window\.addEventListener\('pagehide'/);
  assert.match(student,/document\.hidden&&verifiedStudent\)saveDraft\(\)/);
  assert.match(student,/!availableStudents\.length&&!verifiedStudent/);
  assert.match(student,/loadRoster\(\);return/);
});
