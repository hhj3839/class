const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20260723190000_year_end_cleanup.sql','utf8');
const prd=fs.readFileSync('PRD_v1.2.md','utf8');

test('학급 설정은 보고서·미리보기·이중 확인의 세 단계 자료 정리를 제공한다',()=>{
  for(const id of ['downloadYearEndReport','yearEndReportStored','previewYearEndCleanup','yearEndClassLabel','yearEndConfirmation','yearEndDeletionAccepted','deleteYearEndData'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/학년 말 보고서 PDF 만들기/);
  assert.match(html,/전년도 학급 자료 영구 삭제/);
  assert.match(html,/현재 학년도는 삭제할 수 없습니다/);
});

test('학년 말 보고서는 AI 실행과 관계없이 전체 학생 기록을 PDF로 만든다',()=>{
  assert.match(app,/function yearEndReportContent\(\)/);
  assert.match(app,/buildStudentOverviewReportSection\(student\)/);
  assert.match(app,/buildStudentSupportReportSection\(student\)/);
  assert.match(app,/buildStudentMonthlyResponseReportSection\(student\)/);
  assert.match(app,/teacher_mark_year_end_report_auth/);
  assert.doesNotMatch(app.slice(app.indexOf("$('#downloadYearEndReport')"),app.indexOf("$('#yearEndReportStored')")),/ensureAiAnalysis|runAiAnalysis/);
});

test('삭제 RPC는 전년도·담당 교사·보고서·미리보기·이중 문구를 모두 검증한다',()=>{
  assert.match(migration,/teacher_id=auth\.uid\(\)/);
  assert.match(migration,/school_year>=extract\(year from current_date\)/);
  assert.match(migration,/학년 말 보고서를 먼저 생성/);
  assert.match(migration,/미리보기 이후 학급 자료가 변경/);
  assert.match(migration,/전년도 학급 자료 삭제/);
  assert.match(migration,/학급 이름이 일치하지 않습니다/);
});

test('영구 삭제는 학생 연결 자료를 트랜잭션에서 정리하고 최소 감사 기록만 다시 남긴다',()=>{
  for(const table of ['safety_signal_reviews','observations','ai_analysis_runs','survey_responses','students','data_retention_policies','audit_logs'])assert.match(migration,new RegExp(`delete from public\\.${table} where class_id=p_class_id`));
  assert.match(migration,/participation_token=gen_random_uuid\(\)/);
  assert.match(migration,/year_end_data_deleted/);
  assert.match(migration,/deletion_counts=counts/);
  assert.match(prd,/학년 말 보고서[\s\S]*삭제 대상 미리보기[\s\S]*이중 입력/);
});
