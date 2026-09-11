const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('기존 안전 신호 연결 스키마는 보존하되 관찰 과제 생성은 제거한다',()=>{
  const app=read('app.js');
  const helper=read('safety-signals.js');
  const migration=read('supabase/migrations/20260721090000_link_signals_to_observations.sql');
  assert.match(helper,/async function ensureSignalReview/);
  assert.doesNotMatch(app,/signalReviewIds:reviewIds/);
  assert.doesNotMatch(app,/persistObservation/);
  assert.match(migration,/signal_review_ids uuid\[\]/i);
  assert.match(migration,/safety_signal_reviews r where r\.id=review_id and r\.class_id=p_class_id/i);
});

test('같은 안전 신호의 진행 중 관찰 과제는 UI와 DB에서 중복 생성하지 않는다',()=>{
  const app=read('app.js');
  const migration=read('supabase/migrations/20260721090000_link_signals_to_observations.sql');
  assert.doesNotMatch(app,/getObservations/);
  assert.doesNotMatch(app,/saveObservation/);
  assert.match(migration,/o\.status<>'done'.*o\.signal_review_ids&&saved_review_ids/i);
});
