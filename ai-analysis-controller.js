(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumAiAnalysisController = api;
})(globalThis, function () {
  function create({
    $,
    getSettings,
    getMonth,
    getResponses,
    getAutoKey,
    setAutoKey,
    getTeacherSession,
    captureAnalysisRequest,
    teacherEdgeFunction,
    uiConfirm,
    showToast,
    renderAiAnalysis,
    renderRelationshipAiAnalysis,
    relationshipAnalysisMonth,
    monthOf,
    monthLabel,
    escapeHTML,
  }) {
    async function runAiAnalysis(force = false) {
      const buttons = [
        $('#rerunAiAnalysis'),
        $('#rerunPatternsAi'),
        $('#runAiAnalysis'),
        $('#runPatternsAi'),
      ];
      if (buttons.some((button) => button.disabled)) return;
      if (!getTeacherSession()) {
        showToast('교사 로그인 필요');
        $('#authDialog').showModal();
        return;
      }
      const isCurrent = captureAnalysisRequest('class');
      if (
        force &&
        !(await uiConfirm('AI 새 분석\n외부 AI 전송 및 사용 비용 발생'))
      )
        return;
      if (!isCurrent()) return;
      const labels = buttons.map((button) => button.textContent);
      buttons.forEach((button) => {
        button.disabled = true;
        button.textContent = force ? '안전하게 분석 중…' : '저장 결과 확인 중…';
      });
      try {
        const result = await teacherEdgeFunction('analyze-class', {
          classId: getSettings().classId,
          month: getMonth(),
          force,
        });
        if (!isCurrent()) return;
        renderAiAnalysis(result);
        showToast(
          result.empty
            ? '저장된 분석 없음 · AI 새 분석 가능'
            : result.meta?.cached
              ? '저장된 AI 분석 조회 완료'
              : 'AI 분석 저장 완료',
        );
      } catch (error) {
        if (!isCurrent()) return;
        showToast(`AI 분석 실패: ${error.message}`);
      } finally {
        buttons.forEach((button, index) => {
          button.disabled = false;
          button.textContent = labels[index];
        });
      }
    }
    async function ensureAiAnalysis() {
      const key = `${getSettings().classId}:${getMonth()}`;
      if (
        !getTeacherSession() ||
        !getSettings().classId ||
        !getResponses().some((item) => monthOf(item) === getMonth()) ||
        getAutoKey() === key
      )
        return;
      const isCurrent = captureAnalysisRequest('class');
      setAutoKey(key);
      $('#aiAnalysisMeta').textContent = '저장 결과 확인 중…';
      $('#patternsAiMeta').textContent = '저장 결과 확인 중…';
      $('#aiAnalysisContent').innerHTML =
        '<p class="muted">저장된 결과를 확인하고 있습니다.</p>';
      try {
        const result = await teacherEdgeFunction('analyze-class', {
          classId: getSettings().classId,
          month: getMonth(),
          force: false,
        });
        if (isCurrent()) renderAiAnalysis(result);
      } catch (error) {
        if (!isCurrent()) return;
        setAutoKey('');
        $('#aiAnalysisMeta').textContent = '분석을 불러오지 못함';
        $('#patternsAiMeta').textContent = '분석을 불러오지 못함';
        $('#aiAnalysisContent').innerHTML =
          `<p class="muted">${escapeHTML(error.message)} · 위의 AI 분석 버튼으로 다시 시도해 주세요.</p>`;
      }
    }
    async function runRelationshipAiAnalysis(force = false) {
      if (!getTeacherSession()) {
        showToast('교사 로그인 필요');
        $('#authDialog').showModal();
        return;
      }
      const isCurrent = captureAnalysisRequest('relationship');
      if (
        force &&
        !(await uiConfirm(
          `${monthLabel(relationshipAnalysisMonth())} 관계 AI 새 분석\n외부 AI 전송 및 사용 비용 발생`,
        ))
      )
        return;
      if (!isCurrent()) return;
      const button = force
        ? $('#rerunRelationshipAi')
        : $('#runRelationshipAi');
      if (!button || button.disabled) return;
      const relatedButtons = [
        $('#runRelationshipAi'),
        $('#rerunRelationshipAi'),
      ];
      relatedButtons.forEach((item) => (item.disabled = true));
      const label = button.textContent;
      button.textContent = force ? '안전하게 분석 중…' : '저장 결과 확인 중…';
      try {
        const result = await teacherEdgeFunction('analyze-class', {
          classId: getSettings().classId,
          month: relationshipAnalysisMonth(),
          analysisType: 'relationship',
          force,
        });
        if (!isCurrent()) return;
        renderRelationshipAiAnalysis(result);
        showToast(
          result.empty
            ? '저장된 분석 없음 · AI 새 분석 가능'
            : result.meta?.cached
              ? '선택한 달의 저장된 관계 AI 분석을 불러왔습니다.'
              : '선택한 달의 새 관계 AI 분석을 저장했습니다.',
        );
      } catch (error) {
        if (!isCurrent()) return;
        showToast(`관계 AI 분석 실패: ${error.message}`);
      } finally {
        relatedButtons.forEach((item) => (item.disabled = false));
        button.textContent = label;
      }
    }
    return { runAiAnalysis, ensureAiAnalysis, runRelationshipAiAnalysis };
  }
  return { create };
});
