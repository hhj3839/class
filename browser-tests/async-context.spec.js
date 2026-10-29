const {test, expect} = require('@playwright/test');

test('지연 AI 결과는 현재 월과 로그아웃 초기화를 덮지 않는다', async ({page}) => {
  await page.route('**/*.supabase.co/**', route => route.fulfill({json: []}));
  await page.goto('./');
  const result = await page.evaluate(async () => {
    setTeacherSession({access_token: 'fixture-only', refresh_token: 'fixture-only',
      expires_in: 3600, user: {id: 'fixture', email: 'fixture@example.invalid'}});
    classSettings = {...classSettings, classId: 'fixture', students: []};
    allResponses = ['2026-09', '2026-10'].map(month => ({survey_month: month + '-01', payload_json: {}}));
    const pending = [];
    teacherEdgeFunction = () => new Promise(resolve => pending.push(resolve));
    aiAutoKey = '';
    selectAnalysisMonth('2026-09', false);
    const old = ensureAiAnalysis();
    selectAnalysisMonth('2026-10', false);
    const latest = ensureAiAnalysis();
    const response = month => ({analysis: {priority_students: [], class_patterns: [], insights: []}, meta: {month, cached: true}});
    pending[1](response('2026-10')); await latest;
    pending[0](response('2026-09')); await old;
    const shownMonth = currentAiAnalysis.meta.month;
    const shownMeta = document.querySelector('#aiAnalysisMeta').textContent;
    renderRelationshipActions();
    renderRelationshipAiAnalysis(response('2026-10'));
    const lateRequest = runAiAnalysis(false);
    setTeacherSession(null);
    clearSensitiveState();
    pending[2](response('2026-10')); await lateRequest;
    return {shownMonth, shownMeta, classAi: currentAiAnalysis, relationAi: currentRelationshipAiAnalysis,
      relationMeta: document.querySelector('#relationshipAiMeta')?.textContent || ''};
  });
  expect(result.shownMonth).toBe('2026-10');
  expect(result.shownMeta).toContain('2026년 10월');
  expect(result.classAi).toBeNull();
  expect(result.relationAi).toBeNull();
  expect(result.relationMeta).not.toContain('2026년 10월');
});
