const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const styles=fs.readFileSync('styles.css','utf8');

test('우리 반 현황은 바로 확인·살펴볼 학생 이름 영역을 제공한다',()=>{
  assert.match(html,/id="homeUrgentStudents"/);
  assert.match(html,/id="homeWeekStudents"/);
  assert.match(app,/function homeStudentLinks\(numbers,kind\)/);
  assert.match(app,/data-open-student/);
  assert.match(app,/urgentStudents\.forEach\(number=>observationStudents\.delete\(number\)\)/);
});

test('현황의 학생 이름을 누르면 학생별 살펴보기 한눈에 보기로 이동한다',()=>{
  assert.match(app,/function openStudentDetail\(number\)/);
  assert.match(app,/data-view="student-detail"/);
  assert.match(app,/select\.value=String\(number\)/);
  assert.match(app,/setStudentDetailTab\('summary'\)/);
});

test('학생 바로가기 버튼은 터치와 키보드 포커스를 구분한다',()=>{
  assert.match(styles,/\.home-student-link\{[^}]*min-height:44px/);
  assert.match(styles,/\.home-student-link:hover,\.home-student-link:focus-visible/);
});
