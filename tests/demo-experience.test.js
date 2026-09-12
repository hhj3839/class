const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/demo/enrich_applicant_lab.sql','utf8');
test('실험실 보완은 계정과 학급을 함께 검사하며 기존 자료를 삭제하지 않는다',()=>{for(const expected of ["c.class_id=class_key","c.class_id like 'demo-%'","lower(u.email)='applicant-test@hhj3839.dev'",'기존 자료는 변경하지 않습니다.'])assert.ok(sql.includes(expected));assert.doesNotMatch(sql,/\b(delete|truncate|drop)\b/i)});
test('전출·미응답 예시는 기존 번호 충돌을 막고 반복 실행 시 중복 생성하지 않는다',()=>{for(const expected of ['student_number in(11,12)','on conflict(student_id) do nothing','on conflict(id) do nothing','demo_experience_enriched','set local lock_timeout'])assert.ok(sql.includes(expected))});
