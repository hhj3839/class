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
  assert.match(migration,/call_count>=10/);
  assert.match(app,/teacher_review_ai_analysis_auth/);
});

test('AI Edge Function은 Supabase 교사 토큰을 확인하고 익명 호출을 401로 종료한다',()=>{
  assert.match(edge,/auth\/v1\/user/);
  assert.match(edge,/!authResponse\.ok\|\|!authUser\?\.id/);
  assert.match(edge,/교사 로그인이 필요합니다.'},401/);
  assert.match(edge,/teacher-coaching-v9/);
});

test('AI에는 익명 번호를 보내고 교사 화면에서만 실제 이름으로 표시한다',()=>{
  assert.match(app,/function aiTeacherDisplayText\(value\)/);
  assert.match(app,/학생-\(\\d\+\)\|\(\\d\+\)번 학생/);
  assert.match(app,/classSettings\.students\.find/);
  assert.match(edge,/student:`학생-\$\{Number\(row\.student_number\)\}`/);
});

test('보고서는 옵션 화면 없이 이름과 AI 분석을 바로 저장한다',()=>{
  assert.match(html,/id="reportIncludeNames"/);
  assert.match(html,/id="reportIncludeOriginals"/);
  assert.match(html,/id="printReport"[^>]*>PDF 저장/);
  assert.match(app,/reportIncludeNames'\)\.checked=true/);
  assert.match(app,/reportIncludeOriginals'\)\.checked=false/);
  assert.match(app,/reportForm'\)\.requestSubmit/);
  assert.doesNotMatch(app,/reportDialog'\)\.showModal/);
  assert.match(app,/function buildAiReportSection\(/);
  assert.match(app,/async function downloadPdfDocument\(/);
  assert.match(app,/html2canvas\(/);
  assert.match(app,/pdf\.save\(/);
  assert.doesNotMatch(app,/report\.print\(\)|window\.print\(\)/);
  assert.doesNotMatch(app,/window\.open\('',\s*'_blank'/);
  assert.match(app,/root\.children/);
  assert.match(app,/toDataURL\('image\/png'\)/);
  assert.match(app,/pdf\.getNumberOfPages\(\)/);
});

test('학급 패턴은 내부 근거 꼬리표를 숨기고 실명과 코칭을 표시한다',()=>{
  assert.match(app,/function cleanAiEvidenceText\(value\)/);
  assert.match(app,/계산 결과\|학생 원문\|친구 관찰/);
  assert.match(app,/anonymousNumber,numberLabel/);
  assert.match(app,/학급 운영에 활용하기/);
  assert.match(edge,/classCoachingInstruction/);
  assert.match(edge,/자리·모둠·역할·비공개 대화/);
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
  assert.match(edge,/observation_points/);
  assert.match(edge,/coaching_questions/);
  assert.match(edge,/avoid_actions/);
  assert.match(edge,/의미 있는 복수 신호나 즉시 도움 요청이 있는 학생만/);
  assert.match(edge,/최대 3명까지 선정/);
  assert.match(edge,/근거가 약하면 3명을 채우지 말고/);
  assert.match(app,/주의 깊게 볼 학생 \$\{priority\.length\}명/);
  assert.match(app,/담임 관찰 포인트/);
  assert.match(app,/코칭 방향/);
  assert.match(app,/<strong>담임 해석<\/strong>/);
  assert.match(app,/<strong>코칭<\/strong>/);
  assert.match(app,/학생에게 물어볼 질문/);
  assert.match(app,/이 학생에게 주의할 대응/);
  assert.match(app,/필요할 때 근거 원문 확인/);
  assert.match(app,/연결된 학생 원문 보기/);
  assert.match(app,/function buildAiReportSection/);
  assert.match(app,/확인된 응답/);
});

test('AI 분석은 전월 변화와 유형별 근거를 분리한다',()=>{
  assert.match(edge,/previousMonth/);
  assert.match(edge,/self_rating_deltas/);
  assert.match(edge,/received_average_delta/);
  assert.match(edge,/\[계산 결과\].*\[학생 원문\].*\[친구 관찰\]/);
  assert.match(app,/function aiEvidenceHTML\(/);
  assert.match(app,/이름 · 담임 해석 · 관찰 포인트 · 코칭/);
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
  assert.match(edge,/analysisVersion='2026\.07\.22-teacher-coaching-v9'/);
  assert.match(edge,/analysis:localizeAnalysisValues\(row\.result_json\)/);
  assert.match(app,/meta\.analysisVersion\|\|'버전 확인 불가'/);
});

test('AI 시간 초과와 중단은 failed로 종료하고 호출 한도에서 제외한다',()=>{
  const recovery=fs.readFileSync('supabase/migrations/20260720235945_ai_analysis_failure_recovery.sql','utf8');
  assert.match(edge,/AbortSignal\.timeout\(openAiTimeoutMs\)/);
  assert.match(edge,/AI 응답 시간이 45초를 초과했습니다/);
  assert.match(edge,/p_error_message:text\(reason,500\)/);
  assert.match(edge,/if\(runId&&failAnalysis\)await failAnalysis\(message\)/);
  assert.match(recovery,/add column if not exists error_message/);
  assert.match(recovery,/status='pending' and created_at<now\(\)-interval '5 minutes'/);
  assert.match(recovery,/status='complete' or \(status='pending' and created_at>=now\(\)-interval '5 minutes'\)/);
  assert.match(recovery,/ai_analysis_failed/);
});

test('AI 분석은 마지막 분석 날짜·시간과 담임 실행 정보를 우선 표시한다',()=>{
  assert.match(app,/function formatAnalysisTimestamp/);
  assert.match(app,/timeZone:'Asia\/Seoul'/);
  assert.match(app,/마지막 분석 \$\{formatAnalysisTimestamp\(meta\.generatedAt\)\}/);
  assert.match(app,/담임을 위한 해석 요약/);
  assert.match(app,/이름 · 담임 해석 · 관찰 포인트 · 코칭/);
  assert.doesNotMatch(html,/담임 해석·관찰 포인트·다음 대화와 지원을 먼저 제시/);
});

test('AI 기본 카드는 세 단계로 줄이고 조건부 항목과 실행 개수를 제한한다',()=>{
  assert.match(edge,/teacher-coaching-v9/);
  assert.match(edge,/observation_points:\{type:'array',maxItems:2/);
  assert.match(edge,/coaching_directions:\{type:'array',items:\{type:'string'\},maxItems:2/);
  assert.match(edge,/coaching_questions:\{type:'array',items:\{type:'string'\},maxItems:2/);
  assert.match(edge,/특별한 위험이 없으면 빈 배열을 반환/);
  assert.match(app,/item\.protective_factors\.slice\(0,2\)/);
  assert.match(app,/item\.avoid_actions\.slice\(0,2\)/);
});

test('확장된 교사 지원 결과는 충분한 출력 한도와 중단 감지를 사용한다',()=>{
  assert.match(edge,/max_output_tokens:5000/);
  assert.match(edge,/result\?\.status==='incomplete'/);
  assert.match(edge,/각 문장은 120자 이내/);
});

test('교사용 화면의 AI 명칭은 AI 분석으로 통일한다',()=>{
  assert.match(html,/<h3>AI 분석<\/h3>/);
  assert.doesNotMatch(html,/서버 측 보조 분석|AI 관찰 보조/);
});

test('학생 상세는 한눈에 보기에 응답 요약과 전월 변화를 포함하고 세 탭으로 자료를 구분한다',()=>{
  assert.match(app,/function studentResponseInsights\(/);
  assert.match(app,/function studentResponseInsightHTML\(/);
  assert.match(app,/<h3>지난 제출과 달라진 점<\/h3>/);
  assert.match(app,/지난 제출과 비교/);
  assert.match(app,/친구들이 준 관계 점수 평균 변화/);
  assert.match(app,/친절·성장 문항 이름 언급/);
  assert.match(app,/고마운 학생이나 나아진 학생을 판정한 수치가 아니라/);
  const insight=app.slice(app.indexOf('function studentResponseInsights'),app.indexOf('function renderStudentDetail'));
  assert.doesNotMatch(insight,/자기평가 응답|자기평가 점수 변화|학생이 직접 남긴 내용|직접 작성한 내용의 변화/);
  assert.doesNotMatch(app,/응답 요약과 눈에 띄는 변화|응답에서 알 수 있는 점/);
  assert.doesNotMatch(app,/학생별 간단한 자동 분석/);
  assert.match(app,/data-student-detail-panel="trend"[^`]*studentSupportTimelineSlot/);
  assert.match(app,/data-student-detail-tab="summary"/);
  assert.match(app,/data-student-detail-tab="trend"/);
  assert.match(app,/data-student-detail-tab="responses"/);
  assert.match(html,/<h2>학생별 살펴보기<\/h2>/);
  assert.match(app,/>한눈에 보기<\/button>/);
  assert.match(app,/>변화와 지원<\/button>/);
  assert.match(app,/>월별 응답<\/button>/);
  assert.match(app,/월을 눌러 응답 보기/);
  const responseRecords=app.slice(app.indexOf('const timeline='),app.indexOf('const monthHeads='));
  assert.match(responseRecords,/<details class="student-month-card">/);
  assert.doesNotMatch(responseRecords,/<details class="student-month-card"[^>]*open/);
  assert.match(app,/친구들이 준 관계 점수 평균/);
  assert.doesNotMatch(app,/latest\.selfSmile\?'😊'/);
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
