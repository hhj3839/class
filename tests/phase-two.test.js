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

test('AI에는 익명 번호를 보내고 교사 화면에서만 실제 이름으로 표시한다',()=>{
  assert.match(app,/function aiTeacherDisplayText\(value\)/);
  assert.match(app,/replace\(\/학생-\(\\d\+\)\/g/);
  assert.match(app,/classSettings\.students\.find/);
  assert.match(edge,/student:`학생-\$\{Number\(row\.student_number\)\}`/);
});

test('보고서는 이름과 원문 포함 여부를 교사가 선택한다',()=>{
  assert.match(html,/id="reportIncludeNames"/);
  assert.match(html,/id="reportIncludeOriginals"/);
  assert.match(html,/PDF·인쇄 보고서/);
  assert.match(app,/function printReportDocument\(html\)/);
  assert.match(app,/report\.print\(\)/);
  assert.doesNotMatch(app,/window\.open\('',\s*'_blank'/);
});

test('백업은 서버 권한 검사 후 내보내고 감사 로그와 함께 복구한다',()=>{
  assert.match(app,/teacher_export_class_backup_auth/);
  assert.match(app,/teacher_restore_class_backup_auth/);
  assert.match(migration,/backup_export/);
  assert.match(migration,/backup_restore/);
});

test('다른 시험 학급 복구는 운영 UUID를 복제하지 않고 새로 매핑한다',()=>{
  const safeRestore=fs.readFileSync('supabase/migrations/20260720210000_safe_cross_class_restore.sql','utf8');
  assert.match(safeRestore,/same_class boolean/);
  assert.match(safeRestore,/case when same_class then coalesce\(x\.student_id,gen_random_uuid\(\)\) else gen_random_uuid\(\) end/);
  assert.match(safeRestore,/case when same_class then x\.id else gen_random_uuid\(\) end/);
  assert.match(safeRestore,/'cross_class',not same_class/);
  assert.match(safeRestore,/teacher_id=auth\.uid\(\)/);
});
