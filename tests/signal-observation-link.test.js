const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const migration=fs.readFileSync('supabase/migrations/20260813090000_signal_observation_link.sql','utf8'),app=fs.readFileSync('app.js','utf8'),ui=fs.readFileSync('safety-signals.js','utf8');
test('안전 신호와 관찰 기록은 학급 내부 ID로 연결되고 중복 활성 기록을 막는다',()=>{assert.match(migration,/signal_review_id uuid references public\.safety_signal_reviews/);assert.match(migration,/unique index[\s\S]*class_id,signal_review_id/);assert.match(migration,/s\.class_id=p_class_id/)});
test('관찰 완료 결과는 연결된 안전 신호 상태에 환류된다',()=>{for(const value of ['support_connected','no_issue','closed','fact_checking'])assert.match(migration,new RegExp(value));assert.match(app,/refreshSignalReviews/);assert.match(ui,/관찰 확인 시작/)});
