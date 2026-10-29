(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumSurveyManagement = api;
})(globalThis, function () {
  function create({
    document,
    location,
    navigator,
    getSettings,
    getMonth,
    getResponses,
    monthOf,
    payloadOf,
    monthLabel,
    escapeHTML,
    enrollment: IeumEnrollment,
    qrcode,
    selectAnalysisMonth,
    refreshResponses,
    showToast,
  }) {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    let eventsBound = false;
    function renderParticipationLink() {
      const classSettings = getSettings();
      const code = document.querySelector('.copy-row code'),
        qr = $('#participationQr'),
        token = classSettings.participationToken;
      if (!token) {
        if (code)
          code.textContent = 'DB 마이그레이션 후 설문 링크가 생성됩니다.';
        if (qr) qr.innerHTML = '<p class="muted">설문 링크 없음</p>';
        $('#copyLink').dataset.link = '';
        return;
      }
      const url = new URL('student.html', location.href);
      url.searchParams.set('join', token);
      if (code) code.textContent = url.href;
      $('#copyLink').dataset.link = url.href;
      if (qr) {
        try {
          if (typeof qrcode !== 'function')
            throw new Error('QR 라이브러리 로드 실패');
          const value = qrcode(0, 'M');
          value.addData(url.href);
          value.make();
          qr.innerHTML = value.createImgTag(5, 8, '학생 설문 QR 코드');
        } catch (error) {
          qr.innerHTML =
            '<p class="muted">QR 코드를 만들지 못했습니다. 링크를 복사해 주세요.</p>';
        }
      }
    }
    function renderResponses(responses) {
      const classSettings = getSettings();
      const selectedAnalysisMonth = getMonth();
      const month =
        selectedAnalysisMonth || new Date().toISOString().slice(0, 7);
      const monthly = responses.filter((item) => monthOf(item) === month);
      const submittedNumbers = new Set(
        monthly.map((item) =>
          Number(item.student_number || payloadOf(item).studentNumber),
        ),
      );
      const enrollment = IeumEnrollment.summary(
        classSettings.students,
        submittedNumbers,
        month,
      );
      const total = enrollment.total;
      const submitted = enrollment.submitted.length;
      const rate = total ? Math.round((submitted / total) * 100) : 0;
      $('#studentGrid').innerHTML = classSettings.students
        .map((student) => {
          const status = IeumEnrollment.status(student, month),
            missing = enrollment.missing.some(
              (item) => item.number === student.number,
            );
          return `<span class="student-chip ${status !== 'enrolled' ? 'transferred' : missing ? 'missing' : ''}">${escapeHTML(student.name)}${status !== 'enrolled' ? '(전출)' : ''}</span>`;
        })
        .join('');
      $('#surveyParticipation').textContent =
        `${submitted} / ${total}명 · ${monthLabel(month)}`;
      $('#surveyParticipationBar').style.width = `${rate}%`;
      $('#homeParticipation').innerHTML =
        `${submitted} <small>/ ${total}명</small>`;
      $('#homeParticipationBar').style.width = `${rate}%`;
      $('#homeParticipationText').textContent =
        `${monthLabel(month)} ${rate}% 참여 · 미제출 ${enrollment.missing.length}명${enrollment.partial.length ? ` · 일부 기간 재적 ${enrollment.partial.length}명` : ''}`;
      $('#responseList').innerHTML = monthly.length
        ? `<h4>${monthLabel(month)} 제출 원문</h4>` +
          monthly
            .map((item) => {
              const payload = payloadOf(item);
              const name =
                item.student_name ||
                payload.studentName ||
                classSettings.students.find(
                  (student) => student.number === payload.studentNumber,
                )?.name ||
                '학생';
              const help = payload.helpNow || '괜찮음';
              const worry =
                payload.studentState?.worryDetail || '작성 내용 없음';
              return `<details><summary><strong>${escapeHTML(name)}</strong><span class="tag ${/바로|즉시/.test(help) ? 'urgent' : /이번 주/.test(help) ? 'week' : 'watch'}">${escapeHTML(help)}</span></summary><p>${escapeHTML(worry)}</p></details>`;
            })
            .join('')
        : '<p class="muted">선택한 월에 저장된 응답이 없습니다.</p>';
      renderMonthlySurveyAccordion(responses);
    }
    function renderMonthlySurveyAccordion(responses) {
      const classSettings = getSettings();
      const container = $('#monthlySurveyAccordion');
      if (!container) return;
      const months = [
        ...new Set(
          responses.map(monthOf).filter((month) => /^\d{4}-\d{2}$/.test(month)),
        ),
      ]
        .sort()
        .reverse();
      if (!months.length) {
        container.innerHTML =
          '<h4>지난 설문 제출 현황</h4><p class="muted">제출된 설문 없음</p>';
        return;
      }
      container.innerHTML =
        '<h4>지난 설문 제출 현황</h4>' +
        months
          .map((month, index) => {
            const rows = responses.filter((item) => monthOf(item) === month);
            const submittedNumbers = new Set(
              rows.map((item) =>
                Number(item.student_number || payloadOf(item).studentNumber),
              ),
            );
            const enrollment = IeumEnrollment.summary(
                classSettings.students,
                submittedNumbers,
                month,
              ),
              total = enrollment.total;
            const submitted = enrollment.submitted.map((student) =>
              Number(student.number),
            );
            const submittedSet = new Set(submitted);
            const rate = total
              ? Math.round((submitted.length / total) * 100)
              : 0;
            const missing = enrollment.missing;
            const duplicateCount = Math.max(0, rows.length - submitted.length);
            const submittedNames = classSettings.students
              .filter((student) => submittedSet.has(Number(student.number)))
              .map(
                (student) =>
                  student.name +
                  (IeumEnrollment.status(student, month) !== 'enrolled'
                    ? '(전출)'
                    : ''),
              );
            return `<details><summary><strong>${monthLabel(month)}</strong><span class="tag ${rate >= 80 ? 'open' : rate ? 'week' : 'watch'}">${submitted.length}/${total}명 · ${rate}%</span></summary><div class="evidence-box"><p><strong>제출한 학생 ${submitted.length}명</strong></p><p>${submittedNames.length ? submittedNames.map(escapeHTML).join(', ') : '없음'}</p><p><strong>아직 제출하지 않은 학생 ${missing.length}명</strong></p><p>${missing.length ? missing.map((student) => escapeHTML(student.name)).join(', ') : '없음'}</p><p class="enrollment-note">${enrollment.partial.length ? `전출 학생: ${enrollment.partial.map((student) => `${escapeHTML(student.name)}(전출)`).join(', ')} · 미참여 시 집계 대상에서 제외<br>` : ''}${enrollment.transferred.length ? `집계 제외: ${enrollment.transferred.map((student) => `${escapeHTML(student.name)}(전출)`).join(', ')}` : ''}</p><p class="muted">제출 기록 ${rows.length}건${duplicateCount ? ` · 다시 제출한 기록 ${duplicateCount}건` : ''}</p><button type="button" class="text-button" data-select-survey-month="${month}">이 달의 응답과 분석 보기 →</button></div></details>`;
          })
          .join('');
    }
    function normalizeParticipationLabel() {
      const label = $('#surveyParticipation');
      if (label) label.textContent = label.textContent.split(' · ')[0];
      const responseList = $('#responseList');
      if (responseList) responseList.innerHTML = '';
    }
    function renderResponseManagement() {
      const selectedAnalysisMonth = getMonth();
      const allResponses = getResponses();
      const container = $('#responseManagement');
      if (!container) return;
      const rows = allResponses.filter(
        (item) => monthOf(item) === selectedAnalysisMonth,
      );
      container.innerHTML = rows.length
        ? `<div class="managed-response-list">${rows.map((item) => `<article class="managed-response"><div><strong>${escapeHTML(item.student_name)} · ${new Date(item.submitted_at).toLocaleString('ko-KR')}</strong><p>${item.analysis_excluded ? `분석 제외 · ${escapeHTML(item.correction_note || '사유 없음')}` : '분석에 포함됨'}</p></div><div>${item.analysis_excluded ? `<button class="secondary-button" data-response-action="restore" data-response-id="${item.id}">분석 복원</button>` : `<button class="secondary-button" data-response-action="exclude" data-response-id="${item.id}">분석 제외</button>`}<button class="danger-button" data-response-action="delete" data-response-id="${item.id}" data-student-name="${escapeHTML(item.student_name)}">소프트 삭제</button></div></article>`).join('')}</div>`
        : '<p class="muted">선택한 월에 관리할 응답이 없습니다.</p>';
    }
    function bindEvents() {
      if (eventsBound) return;
      eventsBound = true;
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-survey-admin-tab]');
        if (!button) return;
        const selectedTab = button.dataset.surveyAdminTab,
          panels = {
            link: $('#surveyLinkPanel'),
            status: $('#surveyStatusPanel'),
          };
        Object.entries(panels).forEach(([name, panel]) => {
          panel.hidden = name !== selectedTab;
        });
        $$('[data-survey-admin-tab]').forEach((item) => {
          const selected = item === button;
          item.classList.toggle('active', selected);
          item.setAttribute('aria-selected', String(selected));
        });
      });
      document.addEventListener('click', (event) => {
        const monthButton = event.target.closest('[data-select-survey-month]');
        if (!monthButton) return;
        if (selectAnalysisMonth(monthButton.dataset.selectSurveyMonth))
          showToast(`${monthLabel(getMonth())} 현황을 선택했습니다.`);
      });
      $('#copyLink').addEventListener('click', (event) => {
        const link = event.currentTarget.dataset.link;
        if (!link) {
          showToast('먼저 참여 토큰 DB 마이그레이션을 적용해 주세요.');
          return;
        }
        navigator.clipboard?.writeText(link);
        showToast('참여 링크를 복사했습니다.');
      });
      $('#downloadQr').addEventListener('click', () => {
        const classSettings = getSettings();
        const image = $('#participationQr img');
        if (!image) {
          showToast('저장할 QR 코드가 없습니다.');
          return;
        }
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
          showToast('QR 준비 중 · 잠시 후 재시도');
          return;
        }
        try {
          // The QR library supplies GIF data; encode PNG rather than rename it.
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas unavailable');
          context.drawImage(image, 0, 0);
          const png = canvas.toDataURL('image/png');
          if (!png.startsWith('data:image/png;')) throw new Error('PNG encoding failed');
          const link = document.createElement('a');
          link.href = png;
          link.download = `우리반이음-${classSettings.grade}-${classSettings.classNumber}-참여QR.png`;
          link.click();
        } catch (error) {
          showToast('QR 저장 실패 · 다시 시도');
        }
      });
      $('#refreshResponses').addEventListener('click', refreshResponses);
      $('#surveyMonth').addEventListener('change', (event) =>
        selectAnalysisMonth(event.target.value),
      );
      $('#openStudentSurvey').addEventListener('click', (event) => {
        event.currentTarget.href = $('#copyLink').dataset.link;
      });
    }
    return {
      renderParticipationLink,
      renderResponses,
      renderMonthlySurveyAccordion,
      normalizeParticipationLabel,
      renderResponseManagement,
      bindEvents,
    };
  }
  return { create };
});
