(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumReportContent = api;
})(globalThis, function () {
  function renderSupportDirections(item, show, conciseAiSentence) {
    return item._parent_support && item.support_directions?.length
      ? item.support_directions.map(direction => `<div class="parent-support-direction"><h5>${show(direction.title)}</h5><p>${show(direction.check)}</p><p>${show(direction.support)}</p></div>`).join('')
      : `<p>${show(conciseAiSentence(item.teacher_check, 70))}</p>`;
  }
  function create({
    getSettings,
    getResponses,
    getAiAnalysis,
    escapeHTML,
    aiTeacherDisplayText,
    conciseAiSentence,
    studentObservationSentence,
    cleanAiEvidenceText,
    classMonthlyTrend,
    monthLabel,
    yearEndClassLabel,
    buildStudentOverviewReportSection,
    buildStudentMonthlyResponseReportSection,
  }) {
    function buildAiReportSection(scope, selectedNumber, includeNames) {
      const currentAiAnalysis = getAiAnalysis();
      const analysis = currentAiAnalysis?.analysis || {},
        show = (value) =>
          escapeHTML(includeNames ? aiTeacherDisplayText(value) : value),
        allPriority = (analysis.priority_students || []).slice(0, 3),
        priority =
          scope === 'student'
            ? allPriority.filter(
                (item) => item.student === `학생-${selectedNumber}`,
              )
            : allPriority,
        patterns = scope === 'class' ? analysis.class_patterns || [] : [],
        judgment =
          analysis.overall_judgment ||
          analysis.summary ||
          'AI 종합 판단이 없습니다.';
      return `<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>AI 학생 지원</h2><h3>학생 지원 요약</h3><p>${show(conciseAiSentence(judgment, 100))}</p></div><div class="pdf-block pdf-section-heading"><h3>먼저 살펴볼 학생 ${priority.length}명</h3></div>${
        priority.length
          ? priority
              .map((item) => {
                const observation = studentObservationSentence(
                    (item.observation_points || [])[0],
                  ),
                  question = (item.coaching_questions ||
                    item.teacher_checks ||
                    [])[0];
                return `<article class="pdf-block pdf-student-card"><h4>${show(item.student)} · ${show(item.priority)}</h4><p><b>담임 참고</b><br>${show(conciseAiSentence(item.attention_reason || (item.possible_interpretations || [])[0] || '실제 상황 확인이 필요합니다.'))}</p>${(item.protective_factors || []).length ? `<p><b>참고사항</b><br>${show(conciseAiSentence(item.protective_factors[0], 70))}</p>` : ''}<p><b>교실에서 살펴볼 점</b><br>${show(observation || conciseAiSentence((item.teacher_checks || [])[0] || '교실에서 평소와 다른 모습을 살펴보세요.', 70))}</p><p><b>학생 코칭</b><br>${show(conciseAiSentence(question || '요즘 학교생활에서 내가 도와주면 좋을 일이 있을까?', 60))}</p></article>${(item.evidence || []).length ? `<article class="pdf-block pdf-pattern-card"><h4>${show(item.student)} · 분석 근거</h4><p>${item.evidence.map(value => show(cleanAiEvidenceText(value))).join('<br>')}</p></article>` : ''}`;
              })
              .join('')
          : '<p class="pdf-block">이 범위에서 먼저 살펴볼 학생이 따로 없습니다.</p>'
      }${
        patterns.length
          ? `<div class="pdf-block pdf-section-heading"><h3>이번 달 우리 반에서 보이는 흐름</h3></div>${patterns
              .map(
                (item) =>
                  item._parent_support && item.support_directions?.length
                  ? `<article class="pdf-block pdf-pattern-card"><h4>${show(conciseAiSentence(item.pattern))}</h4><p><b>분석 근거</b><br>${(item.evidence || []).map(value => show(cleanAiEvidenceText(value))).join('<br>')}</p></article>${item.support_directions.map(direction => `<article class="pdf-block pdf-pattern-card"><h4>교실에서 살펴볼 점 · ${show(direction.title)}</h4>${renderSupportDirections({_parent_support:true,support_directions:[direction]},show,value => value)}</article>`).join('')}`
                  :
                  `<article class="pdf-block pdf-pattern-card"><h4>${show(conciseAiSentence(item.pattern))}</h4><p><b>분석 근거</b><br>${(
                    item.evidence || []
                  )
                    .map((value) => show(cleanAiEvidenceText(value)))
                    .join(
                      '<br>',
                    )}</p><section><b>교실에서 살펴볼 점</b>${renderSupportDirections(item, show, value => value)}</section></article>`,
              )
              .join('')}`
          : ''
      }</section>`;
    }
    function yearEndReportContent() {
      const classSettings = getSettings();
      const allResponses = getResponses();
      const trend = classMonthlyTrend(allResponses),
        summary = trend
          .map(
            (row) =>
              `<tr><td>${escapeHTML(monthLabel(row.month))}</td><td>${row.participants}명</td><td>${row.rate}%</td><td>${row.average?.toFixed(1) || '—'}</td></tr>`,
          )
          .join(''),
        students = classSettings.students
          .map(
            (student) =>
              `<section class="pdf-block pdf-section-heading"><h2>${escapeHTML(student.number)}번 ${escapeHTML(student.name)}</h2></section>${buildStudentOverviewReportSection(student)}${typeof buildStudentMonthlyResponseReportSection === 'function' ? buildStudentMonthlyResponseReportSection(student) : ''}`,
          )
          .join('');
      return `<header><h1>${escapeHTML(classSettings.schoolYear)}학년도 ${escapeHTML(yearEndClassLabel())} 학년 말 보고서</h1><p>생성일 ${new Date().toLocaleDateString('ko-KR')} · 학생 ${classSettings.students.length}명 · 설문 ${allResponses.length}건</p></header><p class="pdf-warning">학생 개인정보가 포함된 학교 내부 자료입니다. 학교가 승인한 공간에만 보관하고 불필요한 복사본은 정리하세요.</p><section class="pdf-block pdf-section-heading"><h2>학급 월별 응답 요약</h2></section><table><thead><tr><th>월</th><th>참여</th><th>참여율</th><th>자기평가 평균</th></tr></thead><tbody>${summary || '<tr><td colspan="4">저장된 설문 응답이 없습니다.</td></tr>'}</tbody></table>${students || '<p class="pdf-block">등록된 학생 자료가 없습니다.</p>'}`;
    }
    return { buildAiReportSection, yearEndReportContent };
  }
  return { create, renderSupportDirections };
});
