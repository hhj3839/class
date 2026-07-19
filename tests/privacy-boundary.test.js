const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('교사용 앱은 로그인 전 숨겨지고 전용 로그인 게이트만 표시된다',()=>{
  const html=read('index.html');
  assert.match(html,/id="authGate"/);
  assert.match(html,/id="teacherApp" hidden/);
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
  assert.match(student,/params\.get\('class'\)\|\|''/);
});

test('소스 기본값에 실제 교사 이름과 운영 학급 ID가 없다',()=>{
  const source=read('app.js')+read('index.html')+read('student.js');
  assert.doesNotMatch(source,/홍현진|2026-5-2|김하린/);
});
