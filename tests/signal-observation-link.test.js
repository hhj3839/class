const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('안전 신호 관찰 과제는 검토 ID를 명시적으로 저장한다',()=>{
  const app=read('app.js');
  const helper=read('safety-signals.js');
  const migration=read('supabase/migrations/20260721090000_link_signals_to_observations.sql');
  assert.match(helper,/async function ensureSignalReview/);
  assert.match(app,/signalReviewIds:reviewIds/);
  assert.match(app,/sourceType:'rule_signal'/);
  assert.match(migration,/signal_review_ids uuid\[\]/i);
  assert.match(migration,/safety_signal_reviews r where r\.id=review_id and r\.class_id=p_class_id/i);
});

test('같은 안전 신호의 진행 중 관찰 과제는 UI와 DB에서 중복 생성하지 않는다',()=>{
  const app=read('app.js');
  const migration=read('supabase/migrations/20260721090000_link_signals_to_observations.sql');
  assert.match(app,/item\.status!=='done'.*signalReviewIds/);
  assert.match(app,/진행 중인 관찰 과제가 이미 있습니다/);
  assert.match(migration,/o\.status<>'done'.*o\.signal_review_ids&&saved_review_ids/i);
});
