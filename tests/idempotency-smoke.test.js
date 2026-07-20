const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const sql=fs.readFileSync('supabase/tests/idempotent_submission_smoke_test.sql','utf8');

test('운영 DB 중복 제출 시험은 검증 후 전체 롤백한다',()=>{
  assert.match(sql,/^begin;/m);
  assert.match(sql,/submit_response_by_token/g);
  assert.match(sql,/first_response_id is distinct from retried_response_id/);
  assert.match(sql,/where submission_id=test_submission_id/);
  assert.match(sql,/if stored_count<>1/);
  assert.match(sql,/^rollback;/m);
  assert.doesNotMatch(sql,/\bcommit\b/i);
});
