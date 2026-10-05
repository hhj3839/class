const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/migrations/20261005100000_survey_target_month.sql','utf8'),student=fs.readFileSync('student.js','utf8');
test('설문 대상 월은 교사 권한과 서버 선택값으로 결정한다',()=>{
 assert.match(sql,/teacher_id=auth.uid\(\)/);assert.match(sql,/for share of c/);
 assert.match(sql,/p_payload->>'surveyMonth' is distinct from to_char\(target_month/);
 assert.match(sql,/Asia\/Seoul/);assert.match(sql,/survey_target_month_set/);
});
test('서버는 실제 제출 시각을 유지하고 성공 재시도는 월 변경 후에도 복구한다',()=>{
 assert.match(sql,/target_submission_id,now\(\)/);
 assert.ok(sql.indexOf('if new_id is not null then return new_id')<sql.indexOf("p_payload->>'surveyMonth' is distinct"));
});
test('학생 화면과 임시저장은 서버의 대상 월에 묶인다',()=>{
 assert.match(student,/get_survey_month_by_token/);assert.match(student,/surveyMonth:surveyTargetMonth/);
 assert.match(student,/\$\{joinToken\}:\$\{surveyTargetMonth\}:\$\{verifiedStudent.number\}/);
 assert.doesNotMatch(student,/surveyMonth:new Date/);
});
