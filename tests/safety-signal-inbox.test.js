const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260720235970_safety_signal_inbox.sql');
const app=read('app.js');
const helper=read('safety-signals.js');
const html=read('index.html');

test('안전 신호 확인함은 위험 판정이 아닌 교사 확인 흐름으로 안내한다',()=>{
  assert.match(html,/안전 신호 확인함/);
  assert.match(html,/AI가 확정한 위험이 아니라/);
  for(const label of ['확인 전','대화 예정','사실 확인 중','지원 연결','특이사항 없음','종결'])assert.match(app,new RegExp(label));
});

test('신호 상태는 담당 교사 전용 RPC로 저장되고 감사 로그가 남는다',()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on public\.safety_signal_reviews from anon,authenticated/i);
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
  assert.match(migration,/safety_signal_reviewed/);
  assert.match(migration,/unique\(class_id,signal_key\)/);
  assert.match(helper,/teacher_upsert_signal_review_auth/);
  assert.match(app,/teacher_get_signal_reviews_auth/);
});

test('다른 학급 학생과 응답 ID는 서버에서 채택하지 않는다',()=>{
  assert.match(migration,/s\.class_id=p_class_id/);
  assert.match(migration,/r\.class_id=p_class_id and r\.id=/);
  assert.match(migration,/source_snapshot jsonb/);
});
