(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumStudentDetailView = api;
})(globalThis, function () {
  function create({
    document,
    getSettings,
    getReviews,
    getActiveTab,
    studentDetailRoster,
    escapeHTML,
    enrollment: IeumEnrollment,
    studentMonthlyResponses,
    studentYearTimelineHTML,
    renderStudentCoachingShell,
    setStudentDetailTab,
    studentCurrentSnapshotHTML,
    studentResponseInsightHTML,
    payloadOf,
    receivedPositiveMentions,
    incomingRelationshipFor,
    studentAttentionPanelHTML,
    monthLabel,
    studentVoiceBriefHTML,
  }) {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    function updateStudentStepButtons() {
      const students = studentDetailRoster(),
        select = $('#studentDetailSelect'),
        selected = Number(select?.value),
        index = students.findIndex(
          (student) => Number(student.number) === selected,
        ),
        previous = $('#previousStudent'),
        next = $('#nextStudent'),
        position = $('#studentSelectionPosition');
      if (previous) previous.disabled = index <= 0;
      if (next) next.disabled = index < 0 || index >= students.length - 1;
      if (position)
        position.textContent =
          index < 0
            ? '학생 선택'
            : `${index + 1} / ${students.length}명 · ${students[index].number}번 ${students[index].name}`;
    }
    function renderStudentDetailSelector() {
      const students = studentDetailRoster(),
        select = $('#studentDetailSelect');
      if (!select) return;
      const previous = Number(select.value),
        selected = students.some(
          (student) => Number(student.number) === previous,
        )
          ? previous
          : 0;
      select.innerHTML =
        '<option value="">학생 선택</option>' +
        students
          .map(
            (student) =>
              `<option value="${Number(student.number)}" ${Number(student.number) === selected ? 'selected' : ''}>${Number(student.number)}번 ${escapeHTML(student.name)}${IeumEnrollment.transferDate(student) ? ` (전출 · ${escapeHTML(IeumEnrollment.transferDate(student))})` : ' 학생'}</option>`,
          )
          .join('');
      const printButton = $('#printStudentReport');
      if (printButton) printButton.disabled = !selected;
      $$('[data-student-detail-tab]').forEach(
        (button) => (button.disabled = !selected),
      );
      updateStudentStepButtons();
    }
    function renderStudentDetail() {
      const classSettings = getSettings();
      const signalReviews = getReviews();
      const activeStudentDetailTab = getActiveTab();
      const content = $('#studentDetailContent'),
        select = $('#studentDetailSelect');
      if (!content || !select) return;
      updateStudentStepButtons();
      if (!select.value) {
        $$('[data-student-detail-tab]').forEach(
          (button) => (button.disabled = true),
        );
        content.innerHTML =
          '<div class="panel student-empty"><strong>학생 선택</strong><p class="muted">학생별 요약 · 월별 변화 · 설문 응답 · 코칭</p></div>';
        return;
      }
      const student = classSettings.students.find(
        (row) => Number(row.number) === Number(select.value),
      );
      if (!student) {
        content.innerHTML =
          '<div class="panel"><p class="muted">학급 설정에서 학생을 등록해 주세요.</p></div>';
        return;
      }
      $$('[data-student-detail-tab]').forEach(
        (button) => (button.disabled = false),
      );
      const monthly = studentMonthlyResponses(student.number);
      if (!monthly.length) {
        content.innerHTML = `<div id="studentPanelSummary" data-student-detail-panel="summary" role="tabpanel" aria-labelledby="studentTabSummary"><div class="panel student-empty"><strong>제출된 설문 없음</strong><p class="muted">설문 제출 후 관계 응답 및 변화 확인 가능</p></div></div><div id="studentPanelTrend" data-student-detail-panel="trend" role="tabpanel" aria-labelledby="studentTabTrend">${studentYearTimelineHTML(student)}<section class="panel student-empty"><strong>학교생활 자기평가 변화가 아직 없습니다.</strong><p class="muted">설문 제출 후 월별 변화 확인 가능</p></section></div><div id="studentPanelResponses" data-student-detail-panel="responses" role="tabpanel" aria-labelledby="studentTabResponses"><div class="panel student-empty"><strong>제출된 설문 없음</strong></div></div>`;
        renderStudentCoachingShell(student);
        setStudentDetailTab(activeStudentDetailTab);
        return;
      }
      const studentCurrent = studentCurrentSnapshotHTML(student, monthly),
        studentInsight = studentResponseInsightHTML(student, monthly);
      const ratingLabels = {
          study: '학습',
          listening: '경청',
          respect: '관계 존중',
          manners: '예의',
          responsibility: '책임감',
        },
        latest = payloadOf(monthly.at(-1).item),
        latestMonth = monthly.at(-1).month;
      const trendRows = Object.entries(ratingLabels)
          .map(
            ([key, label]) =>
              `<div class="student-trend-row"><strong>${label}</strong>${monthly
                .map(({ month, item }) => {
                  const score =
                    Number(payloadOf(item).selfRatings?.[key]?.score) || 0;
                  return `<span title="${monthLabel(month)} ${score || '미응답'}점"><i style="--score:${score}"></i><b>${score || '-'}</b></span>`;
                })
                .join('')}</div>`,
          )
          .join(''),
        monthHeads = monthly
          .map(({ month }) => `<span>${Number(month.slice(5))}월</span>`)
          .join('');
      const positiveLatest = receivedPositiveMentions(
          student,
          latestMonth,
        ).length,
        relationLatest = incomingRelationshipFor(student.number, latestMonth),
        attentionPanel = studentAttentionPanelHTML(monthly);
      const timeline = monthly
        .slice()
        .reverse()
        .map(({ month, item }) => {
          const payload = payloadOf(item),
            ratings = payload.selfRatings || {},
            mentions = receivedPositiveMentions(student, month),
            incoming = incomingRelationshipFor(student.number, month),
            state = payload.studentState || {},
            submitted = new Date(
              item.submitted_at || `${month}-01`,
            ).toLocaleDateString('ko-KR'),
            needsAttention =
              /바로|즉시|이번 주/.test(payload.helpNow || '') ||
              signalReviews.some(
                (review) =>
                  review.source_response_id === item.id &&
                  !['support_connected', 'no_issue', 'closed'].includes(
                    review.status,
                  ),
              );
          return `<details class="student-month-card" data-student-response-month="${escapeHTML(month)}"><summary><span><b>${monthLabel(month)}</b><small>${escapeHTML(submitted)} 제출 · 관계 ${incoming ? `${incoming.average.toFixed(1)} / 5` : '응답 없음'}</small></span><span class="student-month-status"><span class="tag ${/바로|즉시/.test(payload.helpNow || '') ? 'urgent' : /이번 주/.test(payload.helpNow || '') ? 'week' : 'open'}">${escapeHTML(payload.helpNow || '도움 요청 없음')}</span>${needsAttention ? '<span class="tag week">확인 필요</span>' : ''}</span></summary><div class="student-attention-source" tabindex="-1"><strong>도움 요청</strong><p>${escapeHTML(payload.helpNow || '도움 요청 없음')}</p></div><div class="monthly-score-list">${Object.entries(
            ratingLabels,
          )
            .map(
              ([key, label]) =>
                `<span>${label} <b>${Number(ratings[key]?.score) || '-'}</b></span>`,
            )
            .join(
              '',
            )}</div><div class="student-detail-grid"><section><h4>학생이 남긴 내용</h4><p><strong>학교생활 고민</strong><br>${escapeHTML(state.worryDetail || '작성 내용 없음')}</p><p><strong>선생님께 듣고 싶은 말</strong><br>${escapeHTML(state.teacherWish || '작성 내용 없음')}</p><p><strong>해결되지 않은 관계</strong><br>${escapeHTML(payload.unresolved?.detail || '작성 내용 없음')}</p></section><section><h4>친구 관계 응답</h4><p><strong>친구 관계 점수 평균</strong><br>${incoming ? `친구 ${incoming.count}명 평균 ${incoming.average.toFixed(1)}점 / 5점` : '해당 월 응답 없음'}</p><p><strong>긍정적인 친구 언급 ${mentions.length}건</strong><br><span class="muted">친절·존중 친구와 긍정적 변화 친구 문항에서 이름을 선택하거나 작성한 횟수</span></p>${mentions.length ? mentions.map((mention) => `<blockquote><b>${escapeHTML(mention.type)}</b> · ${escapeHTML(mention.reporter)}<br>${escapeHTML(mention.text)}</blockquote>`).join('') : '<p class="muted">두 문항에서 이 학생이 선택되거나 이름이 작성된 응답이 없습니다.</p>'}</section></div></details>`;
        })
        .join('');
      content.innerHTML = `<div id="studentPanelSummary" data-student-detail-panel="summary" role="tabpanel" aria-labelledby="studentTabSummary">${attentionPanel}${studentCurrent}${studentVoiceBriefHTML(latest, latestMonth)}</div><div id="studentPanelTrend" data-student-detail-panel="trend" role="tabpanel" aria-labelledby="studentTabTrend" hidden>${studentYearTimelineHTML(student)}${studentInsight}<section class="panel student-trend-panel"><div class="panel-head"><div><p class="eyebrow">제출한 응답 기준</p><h3>학교생활 자기평가 변화</h3></div><span class="confidence">제출한 응답만 반영</span></div><div class="student-trend-scroll"><div class="student-trend-head"><strong>영역</strong>${monthHeads}</div>${trendRows}</div></section></div><div id="studentPanelResponses" data-student-detail-panel="responses" role="tabpanel" aria-labelledby="studentTabResponses" hidden><section class="student-timeline"><div class="panel-head"><div><p class="eyebrow">월을 눌러 자세히 보기</p><h3>월별 설문 응답</h3></div></div>${timeline}</section></div>`;
      renderStudentCoachingShell(student);
      setStudentDetailTab(activeStudentDetailTab);
    }
    return {
      updateStudentStepButtons,
      renderStudentDetailSelector,
      renderStudentDetail,
    };
  }
  return { create };
});
