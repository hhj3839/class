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
