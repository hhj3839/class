(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumStudentResponseData = api;
})(globalThis, function () {
  function create({
    getSettings,
    getResponses,
    monthOf,
    latestByStudent,
    payloadOf,
    monthLabel,
  }) {
    function studentMonthlyResponses(studentNumber) {
      const allResponses = getResponses();
      const months = [
        ...new Set(
          allResponses
            .map(monthOf)
            .filter((month) => /^\d{4}-\d{2}$/.test(month)),
        ),
      ].sort();
      return months
        .map((month) => ({
          month,
          item: latestByStudent(allResponses, month).get(Number(studentNumber)),
        }))
        .filter((row) => row.item);
    }
    function mentionsStudentName(text, student) {
      const classSettings = getSettings();
      const value = String(text || '').trim(),
        name = String(student?.name || '').trim();
      if (!name || !value.includes(name)) return false;
      return !classSettings.students.some(
        (other) =>
          Number(other.number) !== Number(student.number) &&
          String(other.name || '').length > name.length &&
          String(other.name).includes(name) &&
          value.includes(other.name),
      );
    }
    function receivedPositiveMentions(student, month) {
      const allResponses = getResponses();
      const mentions = [];
      latestByStudent(allResponses, month).forEach((item, reporter) => {
        if (reporter === Number(student.number)) return;
        const peer = payloadOf(item).peerObservations || {};
        [
          ['친절·존중', peer.kind],
          ['성장', peer.growth],
        ].forEach(([type, response]) => {
          const text = String(response?.detail || '').trim(),
            selected = (response?.studentNumbers || []).map(Number),
            matched = selected.length
              ? selected.includes(Number(student.number))
              : mentionsStudentName(text, student);
          if (matched)
            mentions.push({
              type,
              text: text || '이름 선택 응답',
              reporter:
                item.student_name ||
                payloadOf(item).studentName ||
                `${reporter}번`,
              structured: selected.length > 0,
            });
        });
      });
      return mentions;
    }
    function incomingRelationshipFor(studentNumber, month) {
      const allResponses = getResponses();
      const values = [];
      latestByStudent(allResponses, month).forEach((item, rater) => {
        if (rater === Number(studentNumber)) return;
        const row = (payloadOf(item).relationships || []).find(
          (entry) => Number(entry.targetNumber) === Number(studentNumber),
        );
        if (row && Number(row.score) > 0) values.push(Number(row.score));
      });
      return values.length
        ? {
            average:
              values.reduce((sum, value) => sum + value, 0) / values.length,
            count: values.length,
          }
        : null;
    }
    function studentResponseInsights(student, monthly) {
      const latestRow = monthly.at(-1),
        previousRow = monthly.at(-2),
        month = latestRow.month,
        incoming = incomingRelationshipFor(student.number, month),
        positiveCount = receivedPositiveMentions(student, month).length,
        summary = [],
        changes = [],
        patterns = [];
      summary.push({
        tone: 'data',
        title: '친구 관계 점수 평균',
        body: incoming
          ? `${monthLabel(month)} 친구 ${incoming.count}명이 준 관계 점수의 평균은 ${incoming.average.toFixed(1)}점 / 5점입니다.`
          : `${monthLabel(month)} 비교할 수 있는 친구 관계 점수 응답이 없습니다.`,
      });
      summary.push({
        tone: 'safe',
        title: '긍정적인 친구 언급',
        body: `친구들이 작성한 ‘친절·존중 친구’와 ‘긍정적 변화 친구’ 서술에서 이 학생의 이름이 ${monthLabel(month)} ${positiveCount}건 확인되었습니다. 고마운 학생이나 나아진 학생을 판정한 수치가 아니라 이름이 포함된 응답 건수입니다.`,
      });
      if (!previousRow) {
        changes.push({
          tone: 'safe',
          title: '아직 전월 비교 자료가 없습니다',
          body: `${monthLabel(month)} 관계 응답을 첫 기준으로 저장했습니다. 다음 제출부터 변화를 비교합니다.`,
        });
      } else {
        const previousIncoming = incomingRelationshipFor(
          student.number,
          previousRow.month,
        );
        if (
          incoming &&
          previousIncoming &&
          Math.abs(incoming.average - previousIncoming.average) >= 0.5
        )
          changes.push({
            tone: 'watch',
            title: '친구 관계 점수 평균 변화',
            body: `${monthLabel(previousRow.month)} ${previousIncoming.average.toFixed(1)}점에서 ${monthLabel(month)} ${incoming.average.toFixed(1)}점으로 ${Math.abs(incoming.average - previousIncoming.average).toFixed(1)}점 ${incoming.average - previousIncoming.average > 0 ? '높게' : '낮게'} 응답했습니다.`,
          });
        const previousPositive = receivedPositiveMentions(
          student,
          previousRow.month,
        ).length;
        if (positiveCount !== previousPositive)
          changes.push({
            tone: 'data',
            title: '친절·성장 문항 이름 언급 변화',
            body: `친절·존중 및 긍정적 변화 문항의 이름 언급이 ${previousPositive}건에서 ${positiveCount}건으로 바뀌었습니다.`,
          });
        if (!changes.length)
          changes.push({
            tone: 'safe',
            title: '이번 응답에서 눈에 띄는 변화가 없습니다',
            body: `${monthLabel(previousRow.month)}과 비교해 친구들이 준 관계 점수 평균 0.5점 이상의 차이나 친절·성장 문항 이름 언급 건수 차이가 나타나지 않았습니다.`,
          });
      }
      const recent = monthly.slice(-3);
      if (recent.length === 3) {
        const relationValues = recent
          .map(
            (row) =>
              incomingRelationshipFor(student.number, row.month)?.average,
          )
          .filter(Number.isFinite);
        if (
          relationValues.length === 3 &&
          Math.max(...relationValues) - Math.min(...relationValues) <= 0.5
        )
          patterns.push({
            tone: 'data',
            title: '비슷하게 이어진 관계 응답',
            body: `최근 3회 제출에서 친구 관계 점수 평균이 ${Math.min(...relationValues).toFixed(1)}~${Math.max(...relationValues).toFixed(1)}점 / 5점 범위로 나타났습니다.`,
          });
        const mentionValues = recent.map(
          (row) => receivedPositiveMentions(student, row.month).length,
        );
        if (mentionValues.every((value) => value > 0))
          patterns.push({
            tone: 'safe',
            title: '이어진 긍정적인 친구 언급',
            body: `최근 3회 제출에서 긍정적인 친구 언급이 매번 1건 이상 확인되었습니다.`,
          });
      }
      const state = !incoming
        ? '관계 응답 없음'
        : !previousRow
          ? '비교 자료 없음'
          : changes.some(
                (item) => item.tone === 'watch' || item.tone === 'data',
              )
            ? '변화 확인'
            : '큰 변화 없음';
      return { month, summary, changes, patterns, state };
    }
    return {
      studentMonthlyResponses,
      mentionsStudentName,
      receivedPositiveMentions,
      incomingRelationshipFor,
      studentResponseInsights,
    };
  }
  return { create };
});
