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
  assert.match(html,/AI 분석 PDF 다운로드/);
  assert.match(app,/function buildAiReportSection\(/);
  assert.match(app,/async function downloadPdfDocument\(/);
  assert.match(app,/html2canvas\(/);
  assert.match(app,/pdf\.save\(/);
  assert.doesNotMatch(app,/report\.print\(\)|window\.print\(\)/);
  assert.doesNotMatch(app,/window\.open\('',\s*'_blank'/);
});

test('AI 자연어 결과를 한국어로만 요청한다',()=>{
  assert.match(edge,/모든 자연어 값은 반드시 자연스럽고 이해하기 쉬운 한국어/);
  assert.match(edge,/영어 문장, 영어 제목, 영어 우선순위 표기는 사용하지 마세요/);
});

test('AI 분석은 받은 평가 기반 최대 3명과 코칭 방향·종합 판단을 만든다',()=>{
  assert.match(edge,/received_relationships/);
  assert.match(edge,/maxItems:3/);
  assert.match(edge,/overall_judgment/);
  assert.match(edge,/coaching_direction/);
  assert.match(edge,/의미 있는 복수 신호나 즉시 도움 요청이 있는 학생만/);
  assert.match(edge,/최대 3명까지 선정/);
  assert.match(edge,/근거가 약하면 3명을 채우지 말고/);
  assert.match(app,/주의 깊게 볼 학생 \$\{priority\.length\}명/);
  assert.match(app,/담임 관찰 포인트·코칭 방향/);
});

test('AI 분석은 전월 변화와 유형별 근거를 분리한다',()=>{
  assert.match(edge,/previousMonth/);
  assert.match(edge,/self_rating_deltas/);
  assert.match(edge,/received_average_delta/);
  assert.match(edge,/\[계산 결과\].*\[학생 원문\].*\[친구 관찰\]/);
  assert.match(app,/function aiEvidenceHTML\(/);
  assert.match(app,/순위가 아닌 지원 확인 대상/);
  assert.match(app,/추가 확인 학생 없음/);
});

test('AI 결과에서 영문 내부 키와 확인되지 않은 직접 경험 표현을 제거한다',()=>{
  assert.match(edge,/function|const localizeAnalysisValues/);
  assert.match(edge,/received_average_delta\/gi,'받은 관계 점수 평균 변화'/);
  assert.match(edge,/needsHelp\/gi,'도움 필요 친구 문항'/);
  assert.match(edge,/hurt\/gi,'상처 행동 문항'/);
  assert.match(edge,/내부 JSON 필드명이나 영문 변수명을 결과에 절대 복사하지 말고/);
  assert.match(edge,/반드시 해당 응답자 수 또는 응답 건수를 함께 쓰세요/);
  assert.match(edge,/현재 입력에는 직접 경험·직접 목격·전해 들음의 구분 정보가 없으므로/);
  assert.match(edge,/직접 호소\/g,'학생이 작성한 서술'/);
  assert.match(edge,/localizeAnalysisValues\(JSON\.parse\(outputText\)\)/);
  assert.match(edge,/analysisVersion='2026\.07\.20-korean-fields-v2'/);
  assert.match(edge,/analysis:localizeAnalysisValues\(row\.result_json\)/);
  assert.match(app,/meta\.analysisVersion\|\|'버전 확인 불가'/);
});

test('교사용 화면의 AI 명칭은 AI 분석으로 통일한다',()=>{
  assert.match(html,/<h3>AI 분석<\/h3>/);
  assert.doesNotMatch(html,/서버 측 보조 분석|AI 관찰 보조/);
});

test('학생 상세는 어려움 은폐 가능성과 낮은 변별력을 안전하게 점검한다',()=>{
  assert.match(html,/id="studentResponseInsight"/);
  assert.match(app,/function studentResponseInsights\(/);
  assert.match(app,/관계 응답의 변별력이 낮을 수 있어요/);
  assert.match(app,/어려움을 드러내지 않았을 가능성을 확인해 주세요/);
  assert.match(app,/어려움을 숨긴다고 단정하지 말고/);
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
