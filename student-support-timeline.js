const studentSupportFilters={month:'all',kind:'all'};
let studentSupportFilterStudent=null;
const studentReviewStatusLabels={needs_review:'이번 달 확인 필요',reviewed:'담임 확인 완료',carry_forward:'다음 설문에서 다시 보기',rapid_followup:'빠른 추가 확인'};

function studentReviewCycleFor(student,month){
  return studentReviewCycles.find(item=>String(item.student_id)===String(student.studentId)&&String(item.survey_month||'').slice(0,7)===month)||null
}

function previousCarryForwardFor(student,month){
  const previous=previousMonth(month),cycle=studentReviewCycleFor(student,previous);
  return cycle?.status==='carry_forward'?cycle:null
}

function studentReviewPanelHTML(student,month,supportSummary){
  const cycle=studentReviewCycleFor(student,month),carried=previousCarryForwardFor(student,month),status=cycle?.status||(supportSummary.count||carried?'needs_review':'reviewed'),label=studentReviewStatusLabels[status],focus=cycle?.focus_note||carried?.focus_note||'',showControls=Boolean(supportSummary.count||cycle||carried),date=cycle?.follow_up_date||'';
  const detail=status==='rapid_followup'?`${date||'날짜 미정'}${focus?` · ${focus}`:''}`:status==='carry_forward'?(focus||'다음 설문 응답과 함께 다시 살펴봅니다.'):status==='reviewed'?'이번 달 확인을 마쳤습니다.':carried?`지난달부터 이어서 볼 내용 · ${focus}`:supportSummary.count?`${supportSummary.count}건의 응답·기록을 살펴봐 주세요.`:'이번 달에 별도로 확인할 내용이 없습니다.';
  const editing=!cycle,editStatus=cycle?status:'';
  return`<section class="panel student-attention-summary student-review-panel ${status==='reviewed'?'clear':'needs-attention'}"><div class="student-review-heading"><div><span>담임 확인</span><strong>${escapeHTML(label)}</strong></div><div class="student-review-summary"><p>${escapeHTML(detail)}</p>${showControls&&cycle?'<button type="button" class="text-button" data-edit-student-review aria-expanded="false">변경</button>':''}</div></div>${showControls?`<div class="student-review-controls" data-student-review-controls data-student-id="${escapeHTML(student.studentId||'')}" data-review-month="${escapeHTML(month)}" ${editing?'':'hidden'}><p class="student-review-question">이 학생의 응답을 어떻게 이어서 볼까요?</p><div class="student-review-actions" role="group" aria-label="이번 달 담임 확인 결과"><button type="button" data-student-review-action="reviewed" aria-pressed="${editStatus==='reviewed'}">확인 완료</button><button type="button" data-student-review-action="carry_forward" aria-pressed="${editStatus==='carry_forward'}">다음 설문에서 다시 보기</button><button type="button" data-student-review-action="rapid_followup" aria-pressed="${editStatus==='rapid_followup'}">빠른 추가 확인</button></div><input type="hidden" data-student-review-status value="${escapeHTML(editStatus)}"><label class="student-review-focus" ${['carry_forward','rapid_followup'].includes(editStatus)?'':'hidden'}><span>다음에 살펴볼 내용</span><input data-student-review-focus maxlength="300" value="${escapeHTML(focus)}" placeholder="예: 모둠에서 의견을 말할 기회가 있는지"></label><label data-student-review-date-wrap ${editStatus==='rapid_followup'?'':'hidden'}><span>빠른 확인 날짜</span><input type="date" data-student-review-date value="${escapeHTML(date)}"></label><div class="student-review-save-actions">${cycle?'<button type="button" class="secondary-button" data-cancel-student-review>취소</button>':''}<button type="button" class="primary-button" data-save-student-review ${editStatus?'':'disabled'}>저장</button></div></div>`:''}</section>`
}

function studentSupportItems(student){
  const number=Number(student.number),studentId=student.studentId||null,items=[];
  studentMonthlyResponses(number).forEach(({month,item})=>items.push({kind:'survey',date:item.submitted_at||`${month}-01`,label:'설문 제출',title:`${monthLabel(month)} 학교생활 돌아보기`,detail:payloadOf(item).helpNow||'도움 요청 없음',tone:/바로|즉시/.test(payloadOf(item).helpNow||'')?'urgent':'survey'}));
  studentReviewCycles.filter(review=>studentId&&String(review.student_id)===String(studentId)).forEach(review=>items.push({kind:'review',date:review.updated_at||review.survey_month,label:'담임 확인',title:`${monthLabel(String(review.survey_month).slice(0,7))} ${studentReviewStatusLabels[review.status]||review.status}`,detail:review.status==='rapid_followup'&&review.follow_up_date?`빠른 확인 ${review.follow_up_date}`:studentReviewStatusLabels[review.status]||review.status,tone:review.status==='reviewed'?'done':review.status==='rapid_followup'?'urgent':'progress',note:review.focus_note}));
  signalReviews.filter(review=>(studentId&&review.student_id===studentId)||Number(review.student_number)===number).forEach(review=>items.push({kind:'signal',date:review.updated_at||review.follow_up_date||'',label:'확인이 필요한 응답',title:review.source_snapshot?.title||'응답 확인 항목',detail:signalReviewStatuses[review.status]||review.status,tone:['support_connected','no_issue','closed'].includes(review.status)?'done':review.status==='unreviewed'?'urgent':'progress',followUpDate:review.follow_up_date,note:review.note}));
  getObservations().filter(item=>(studentId&&item.studentId===studentId)||Number(item.studentNumber)===number).forEach(item=>{const resolution=[item.resolutionReason&&`종결 사유: ${item.resolutionReason}`,item.followUpResult&&`후속 확인 결과: ${item.followUpResult}`,item.needsFollowUp&&'추가 확인 필요'].filter(Boolean).join(' · ');items.push({kind:'observation',id:item.id,date:item.followUpDate||item.date||'',label:'교사 확인 기록',title:item.title,detail:item.status==='done'?({support:'지원 연결',no_issue:'특이사항 없음',continue:'계속 관찰'}[item.outcome]||'확인 완료'):item.status==='doing'?'확인 중':'확인 예정',tone:item.status==='done'?'done':'progress',note:resolution||item.observedFact||item.detail})});
  return items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

function studentSupportItemHTML(item){return`<article class="student-support-item ${item.tone}"><span class="support-dot"></span><div><header><span>${escapeHTML(item.label)}</span><time>${escapeHTML(String(item.date||'날짜 미정').slice(0,10))}</time></header><h4>${escapeHTML(item.title)}</h4><p><strong>${escapeHTML(item.detail||'')}</strong>${item.note?`<br>${escapeHTML(item.note)}`:''}</p>${item.kind==='observation'?`<button class="text-button" type="button" data-edit-observation="${item.id}">관찰 기록 열기</button>`:''}</div></article>`}

function filteredStudentSupportItems(items){return items.filter(item=>(studentSupportFilters.month==='all'||String(item.date||'').slice(0,7)===studentSupportFilters.month)&&(studentSupportFilters.kind==='all'||item.kind===studentSupportFilters.kind))}

function buildStudentOverviewReportSection(student){
  const monthly=studentMonthlyResponses(student.number),latest=monthly.at(-1),relationship=latest?incomingRelationshipFor(student.number,latest.month):null,mentions=latest?receivedPositiveMentions(student,latest.month).length:0,support=studentOpenSupportSummary(student),review=latest?studentReviewCycleFor(student,latest.month):null,reviewLabel=review?studentReviewStatusLabels[review.status]:support.count?'이번 달 확인 필요':'별도 확인 내용 없음';
  return`<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>학생 한눈에 보기</h2><p>${latest?`${escapeHTML(monthLabel(latest.month))} 최근 응답 기준`:'아직 제출된 설문 없음'}</p></div><article class="pdf-block pdf-student-card"><p><b>담임 확인</b><br>${escapeHTML(reviewLabel)}${review?.focus_note?` · ${escapeHTML(review.focus_note)}`:''}${review?.status==='rapid_followup'&&review.follow_up_date?` · ${escapeHTML(review.follow_up_date)}`:''}</p><p><b>친구 관계 점수 평균</b><br>${relationship?`${relationship.average.toFixed(1)}점 / 5점 · 친구 ${relationship.count}명 응답`:'비교할 수 있는 관계 응답이 없습니다.'}</p><p><b>긍정적인 친구 언급</b><br>${mentions}건 · 친절·존중 친구와 긍정적 변화 친구 문항 기준</p></article></section>`
}

function buildStudentMonthlyResponseReportSection(student){
  const rows=studentMonthlyResponses(student.number).slice().reverse().slice(0,6);
  return`<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>월별 설문 응답 요약</h2></div>${rows.length?rows.map(({month,item})=>{const payload=payloadOf(item),relationship=incomingRelationshipFor(student.number,month);return`<article class="pdf-block pdf-support-item"><h4>${escapeHTML(monthLabel(month))} · ${escapeHTML(payload.helpNow||'도움 요청 없음')}</h4><p><b>친구 관계 점수 평균</b> ${relationship?`${relationship.average.toFixed(1)} / 5`:'응답 없음'}<br><b>학교생활 고민</b> ${escapeHTML(payload.studentState?.worryDetail||'작성 내용 없음')}</p></article>`}).join(''):'<p class="pdf-block">아직 제출된 설문이 없습니다.</p>'}</section>`
}

function buildStudentSupportReportSection(student){
  const items=studentSupportItems(student),recent=items.slice(0,8),counts={survey:items.filter(item=>item.kind==='survey').length,review:items.filter(item=>item.kind==='review').length,signal:items.filter(item=>item.kind==='signal').length,observation:items.filter(item=>item.kind==='observation').length},open=items.filter(item=>(item.kind==='signal'||item.kind==='observation'||item.kind==='review')&&item.tone!=='done').length;
  return`<section class="pdf-ai-section"><div class="pdf-block pdf-section-heading"><h2>담임 확인 이력 요약</h2><p>설문 ${counts.survey}건 · 월별 담임 확인 ${counts.review}건 · 확인이 필요한 응답 ${counts.signal}건 · 교사 확인 기록 ${counts.observation}건 · 확인 진행 중 ${open}건</p></div>${recent.length?recent.map(item=>`<article class="pdf-block pdf-support-item"><h4>${escapeHTML(String(item.date||'날짜 미정').slice(0,10))} · ${escapeHTML(item.label)}</h4><p><b>${escapeHTML(item.title)}</b><br>${escapeHTML(item.detail||'')}${item.note?`<br>${escapeHTML(item.note)}`:''}</p></article>`).join(''):'<p class="pdf-block">연결된 담임 확인 기록이 없습니다.</p>'}</section>`
}

function renderStudentSupportTimeline(){
  const select=$('#studentDetailSelect'),content=$('#studentDetailContent');if(!select?.value||!content)return;
  const student=classSettings.students.find(row=>Number(row.number)===Number(select.value));if(!student)return;
  if(studentSupportFilterStudent!==Number(student.number)){studentSupportFilterStudent=Number(student.number);studentSupportFilters.month='all';studentSupportFilters.kind='all'}
  const items=studentSupportItems(student),supportItems=items.filter(item=>item.kind!=='survey'),slot=content.querySelector('#studentSupportTimelineSlot');
  if(!supportItems.length){if(slot)slot.replaceChildren();return}
  const months=[...new Set(items.map(item=>String(item.date||'').slice(0,7)).filter(month=>/^\d{4}-\d{2}$/.test(month)))].sort().reverse(),visibleItems=filteredStudentSupportItems(items),openSignals=signalReviews.filter(review=>((student.studentId&&review.student_id===student.studentId)||Number(review.student_number)===Number(student.number))&&!['support_connected','no_issue','closed'].includes(review.status)),openObservations=getObservations().filter(item=>Number(item.studentNumber)===Number(student.number)&&item.status!=='done'),openCount=openSignals.length+openObservations.length,latestMonth=studentMonthlyResponses(student.number).at(-1)?.month,currentReview=latestMonth?studentReviewCycleFor(student,latestMonth):null,currentLabel=currentReview?studentReviewStatusLabels[currentReview.status]:openCount?'이번 달 확인 필요':'완료된 담임 확인 기록';
  const panel=document.createElement('section');panel.className=`panel student-support-panel${openCount?' has-open-support':''}`;panel.innerHTML=`<div class="student-support-glance"><div><p class="eyebrow">담임 확인 기록</p><h3>${escapeHTML(currentLabel)}</h3></div><p><span>진행 중</span><strong>${openCount}건</strong></p></div><details class="student-support-details"><summary>담임 확인 이력 보기 <span>${supportItems.length}건</span></summary><div class="student-support-summary"><article><span>월별 담임 확인</span><strong>${items.filter(item=>item.kind==='review').length}</strong></article><article><span>확인이 필요한 응답</span><strong>${items.filter(item=>item.kind==='signal').length}</strong></article><article><span>교사 확인 기록</span><strong>${items.filter(item=>item.kind==='observation').length}</strong></article></div><div class="student-support-filters"><label><span>월</span><select data-support-filter="month"><option value="all">모든 월</option>${months.map(month=>`<option value="${month}" ${studentSupportFilters.month===month?'selected':''}>${monthLabel(month)}</option>`).join('')}</select></label><label><span>살펴볼 기록</span><select data-support-filter="kind"><option value="all">전체 기록</option><option value="survey" ${studentSupportFilters.kind==='survey'?'selected':''}>설문 제출</option><option value="review" ${studentSupportFilters.kind==='review'?'selected':''}>월별 담임 확인</option><option value="signal" ${studentSupportFilters.kind==='signal'?'selected':''}>확인이 필요한 응답</option><option value="observation" ${studentSupportFilters.kind==='observation'?'selected':''}>교사 확인 기록</option></select></label><span class="muted">${visibleItems.length}건 표시</span></div><div class="student-support-list">${visibleItems.length?visibleItems.map(studentSupportItemHTML).join(''):'<p class="muted">선택한 조건에 해당하는 기록이 없습니다.</p>'}</div></details></section>`;
  if(slot)slot.replaceChildren(panel);else content.append(panel);
  panel.querySelectorAll('[data-support-filter]').forEach(select=>select.addEventListener('change',event=>{studentSupportFilters[event.target.dataset.supportFilter]=event.target.value;renderStudentSupportTimeline()}));
}

$('#studentDetailSelect').addEventListener('change',renderStudentSupportTimeline);
document.addEventListener('class-ieum:data-updated',renderStudentSupportTimeline);
document.addEventListener('click',async event=>{
  const edit=event.target.closest?.('[data-edit-student-review]');
  if(edit){const controls=edit.closest('.student-review-panel')?.querySelector('[data-student-review-controls]');if(controls){controls.hidden=false;edit.setAttribute('aria-expanded','true');controls.querySelector('[data-student-review-action][aria-pressed="true"]')?.focus()}return}
  const cancel=event.target.closest?.('[data-cancel-student-review]');
  if(cancel){const controls=cancel.closest('[data-student-review-controls]'),editButton=controls?.closest('.student-review-panel')?.querySelector('[data-edit-student-review]');if(controls)controls.hidden=true;if(editButton)editButton.setAttribute('aria-expanded','false');return}
  const action=event.target.closest?.('[data-student-review-action]');
  if(action){const controls=action.closest('[data-student-review-controls]'),status=action.dataset.studentReviewAction;controls.querySelectorAll('[data-student-review-action]').forEach(button=>button.setAttribute('aria-pressed',String(button===action)));controls.querySelector('[data-student-review-status]').value=status;controls.querySelector('.student-review-focus').hidden=!['carry_forward','rapid_followup'].includes(status);controls.querySelector('[data-student-review-date-wrap]').hidden=status!=='rapid_followup';controls.querySelector('[data-save-student-review]').disabled=false;return}
  const button=event.target.closest?.('[data-save-student-review]');if(!button)return;
  const controls=button.closest('[data-student-review-controls]'),studentId=controls?.dataset.studentId,month=controls?.dataset.reviewMonth,status=controls?.querySelector('[data-student-review-status]')?.value,focus=controls?.querySelector('[data-student-review-focus]')?.value.trim()||'',date=controls?.querySelector('[data-student-review-date]')?.value||'';
  if(!studentId){showToast('학생 식별 정보를 불러오지 못했습니다.');return}
  if(['carry_forward','rapid_followup'].includes(status)&&!focus){showToast('다시 살펴볼 내용을 입력해 주세요.');return}
  if(status==='rapid_followup'&&!date){showToast('빠른 추가 확인 날짜를 입력해 주세요.');return}
  button.disabled=true;
  try{
    await teacherRpc('teacher_upsert_student_review_cycle_auth',{p_class_id:classSettings.classId,p_student_id:studentId,p_survey_month:`${month}-01`,p_status:status,p_focus_note:focus,p_follow_up_date:status==='rapid_followup'?date:null});
    await refreshStudentReviewCycles();renderStudentDetail();showToast('이번 달 담임 확인을 저장했습니다.')
  }catch(error){button.disabled=false;showToast(`담임 확인 저장 실패: ${error.message}`)}
});
