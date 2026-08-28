const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const seed=fs.readFileSync(path.join(root,'supabase','demo','seed_demo_class.sql'),'utf8');
const reset=fs.readFileSync(path.join(root,'supabase','demo','reset_demo_class.sql'),'utf8');
const guide=fs.readFileSync(path.join(root,'DEMO_CLASS_GUIDE.md'),'utf8');
const rolling=fs.readFileSync(path.join(root,'supabase','migrations','20260828090000_roll_demo_months_forward.sql'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('데모 생성 SQL은 이메일 교체를 강제하고 지정 교사의 demo 학급만 초기화한다',()=>{
  assert.match(seed,/REPLACE_WITH_TEST_TEACHER_EMAIL/);
  assert.match(seed,/concat\('REPLACE_WITH_TEST','_TEACHER_EMAIL'\)/);
  assert.match(seed,/teacher_id = target_teacher/);
  assert.match(seed,/class_id like 'demo-%'/);
  assert.doesNotMatch(seed,/delete from public\.classes\s*;/i);
});

test('데모 생성 SQL은 핵심 화면 상태와 저장 AI 결과를 포함한다',()=>{
  for(const term of ['survey_responses','safety_signal_reviews','observations','ai_analysis_runs','analysis_excluded=true','demo-saved-analysis']){
    assert.match(seed,new RegExp(term));
  }
  assert.match(seed,/jsonb_build_object\('students',10,'months',12\)/);
  assert.match(seed,/for student_number in 1\.\.10/);
  assert.match(seed,/month_offset in reverse 11\.\.0/);
});

test('데모 관계 응답은 묶음·연결·비대칭·월별 변화를 의도적으로 포함한다',()=>{
  assert.match(seed,/A\(1·3·9\), B\(2·5·7\), C\(4·6·8\)/);
  assert.match(seed,/\(3,5\),\(5,3\),\(7,8\),\(8,7\)/);
  assert.match(seed,/\(1,2\),\(5,4\)/);
  assert.match(seed,/greatest\(3,5-month_offset\)/);
  assert.match(seed,/least\(4,2\+month_offset\)/);
  assert.match(seed,/target_number=4/);
});

test('데모 삭제 SQL은 대상 교사와 demo 접두사를 함께 검사한다',()=>{
  assert.match(reset,/teacher_id=target_teacher/);
  assert.match(reset,/class_id like 'demo-%'/);
  assert.match(reset,/if not found then raise exception/);
});

test('데모 안내는 생성, 확인, 삭제와 실제 API 사용 주의를 설명한다',()=>{
  for(const term of ['SQL Editor','화면별 빠른 확인','다른 시험 교사','새 분석','reset_demo_class.sql']){
    assert.match(guide,new RegExp(term));
  }
});

test('실험실 계정은 로그인할 때 데모 자료를 현재 달까지 자동 이동한다',()=>{
  assert.match(app,/startsWith\('demo-'\)/);
  assert.match(app,/teacher_roll_demo_months_forward_auth/);
  assert.match(rolling,/p_class_id not like 'demo-%'/);
  assert.match(rolling,/teacher_id=auth\.uid\(\)/);
  assert.match(rolling,/max\(r\.survey_month\)/);
  assert.match(rolling,/months_to_shift<=0 then return 0/);
  assert.match(rolling,/update public\.survey_responses/);
  assert.match(rolling,/update public\.ai_analysis_runs/);
  assert.match(rolling,/update public\.observations/);
  assert.match(rolling,/demo_months_rolled_forward/);
});
