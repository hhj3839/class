const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const edge=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260720170000_ai_reports_backup.sql','utf8');

test('AI 분석은 DB 캐시·월 호출 제한·교사 검토 상태를 사용한다',()=>{
  assert.match(edge,/teacher_get_cached_ai_analysis_auth/);
  assert.match(edge,/teacher_begin_ai_analysis_auth/);
  assert.match(migration,/call_count>=5/);
  assert.match(app,/teacher_review_ai_analysis_auth/);
});

test('보고서는 이름과 원문 포함 여부를 교사가 선택한다',()=>{
  assert.match(html,/id="reportIncludeNames"/);
  assert.match(html,/id="reportIncludeOriginals"/);
  assert.match(app,/PDF로 저장·인쇄/);
});

test('백업은 서버 권한 검사 후 내보내고 감사 로그와 함께 복구한다',()=>{
  assert.match(app,/teacher_export_class_backup_auth/);
  assert.match(app,/teacher_restore_class_backup_auth/);
  assert.match(migration,/backup_export/);
  assert.match(migration,/backup_restore/);
});
