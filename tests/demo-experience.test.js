const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sql=fs.readFileSync('supabase/demo/enrich_applicant_lab.sql','utf8');
test('폐기된 실험실 보완은 AI 날짜를 변경하지 않는다',()=>{assert.doesNotMatch(sql,/\bupdate\b/i);assert.match(sql,/2026-09-15/)});
test('이전 보완 링크를 실행해도 자료를 변경하거나 삭제하지 않는다',()=>{assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|drop)\b/i);assert.match(sql,/기존 자료는 변경하지 않습니다/)});
test('삭제한 두 가상 학생을 재등록하지 않고 폐기 안내만 한다',()=>{assert.doesNotMatch(sql,/insert into public\.students/i);assert.match(sql,/raise notice/);assert.match(sql,/현재 실험실은 10명/)});
