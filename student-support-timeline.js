function buildStudentOverviewReportSection(student){
  const monthly=studentMonthlyResponses(student.number),latest=monthly.at(-1),relationship=latest?incomingRelationshipFor(student.number,latest.month):null,mentions=latest?receivedPositiveMentions(student,latest.month).length:0,attention=studentAttentionResponse(monthly);
  return`<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>학생 한눈에 보기</h2><p>${latest?`${escapeHTML(monthLabel(latest.month))} 최근 응답 기준`:'아직 제출된 설문 없음'}</p></div><article class="pdf-block pdf-student-card">${attention?`<p><b>확인 필요</b><br>${escapeHTML(payloadOf(attention.item).helpNow||'확인이 필요한 응답이 있습니다.')}</p>`:''}<p><b>친구 관계 점수 평균</b><br>${relationship?`${relationship.average.toFixed(1)}점 / 5점 · 친구 ${relationship.count}명 응답`:'비교할 수 있는 관계 응답이 없습니다.'}</p><p><b>긍정적인 친구 언급</b><br>${mentions}건 · 친절·존중 친구와 긍정적 변화 친구 문항 기준</p></article></section>`
}

function buildStudentMonthlyResponseReportSection(student){
  const rows=studentMonthlyResponses(student.number).slice().reverse().slice(0,6);
  return`<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>월별 설문 응답 요약</h2></div>${rows.length?rows.map(({month,item})=>{const payload=payloadOf(item),relationship=incomingRelationshipFor(student.number,month);return`<article class="pdf-block pdf-support-item"><h4>${escapeHTML(monthLabel(month))} · ${escapeHTML(payload.helpNow||'도움 요청 없음')}</h4><p><b>친구 관계 점수 평균</b> ${relationship?`${relationship.average.toFixed(1)} / 5`:'응답 없음'}<br><b>학교생활 고민</b> ${escapeHTML(payload.studentState?.worryDetail||'작성 내용 없음')}</p></article>`}).join(''):'<p class="pdf-block">아직 제출된 설문이 없습니다.</p>'}</section>`
}
