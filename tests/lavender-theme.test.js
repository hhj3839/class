const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const theme=fs.readFileSync('lavender-theme.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const student=fs.readFileSync('student.html','utf8');

test('교사와 학생 화면은 같은 연보라 테마를 마지막에 불러온다',()=>{
  assert.match(index,/lavender-theme\.css\?v=20260828-2/);
  assert.match(student,/lavender-theme\.css\?v=20260828-2/);
  assert.match(theme,/--blue:#7656b5/);
  assert.match(theme,/\.sidebar\{background:linear-gradient\(180deg,#49316f/);
});

test('의미 없는 청록 보조 UI는 연보라 계열로 정리한다',()=>{
  for(const selector of ['.ai-analysis-panel','.student-page .self-row','.pilot-metric-grid strong','.actual-relations [data-relation-edge]']){
    assert.ok(theme.includes(selector),`${selector} 테마가 필요합니다.`);
  }
});

test('위험·주의·완료 상태는 기존 의미 색상 변수를 유지한다',()=>{
  assert.doesNotMatch(theme,/--red:/);
  assert.doesNotMatch(theme,/--orange:/);
  assert.doesNotMatch(theme,/--green:/);
  assert.match(theme,/relationship-new.*#d2a24b/);
});

test('UI 상태 역할 색상과 교사 홈의 시각적 우선순위를 고정한다',()=>{
  for(const token of ['--action:#7656b5','--information:#716882','--success:#287d5a','--warning:#c5772e','--danger:#c94a4a','--inactive:#958ca0']){
    assert.ok(theme.includes(token),`${token} 색상 역할이 필요합니다.`);
  }
  assert.match(theme,/\.home-participation-card/);
  assert.match(theme,/\.home-priority-card\.urgent/);
  assert.match(theme,/\.insight\.trend-neutral/);
});
