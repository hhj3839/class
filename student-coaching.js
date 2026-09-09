const studentCoachingDrafts=new Map();
const studentCoachingState=new Map();let studentCoachingEpoch=0;
function coachingKey(){const student=classSettings.students.find(row=>Number(row.number)===Number($('#studentDetailSelect')?.value));return student?.studentId?`${classSettings.classId}:${student.studentId}`:''}
function clearStudentCoachingState(){studentCoachingEpoch++;studentCoachingState.clear();studentCoachingDrafts.clear();const dialog=$('#studentCoachingEvidence');if(dialog){dialog.close();$('#studentCoachingSource').replaceChildren()}}
function renderStudentCoachingShell(student){
  const content=$('#studentDetailContent');if(!content||$('#studentPanelCoaching'))return;
  content.insertAdjacentHTML('beforeend','<section id="studentPanelCoaching" data-student-detail-panel="coaching" role="tabpanel" aria-labelledby="studentTabCoaching" hidden><div id="studentCoachingContent" class="panel student-coaching-card" aria-live="polite"></div></section>');
  if(!student.studentId){$('#studentCoachingContent').innerHTML='<p>학생 명단을 DB에 저장한 뒤 코칭 카드를 사용할 수 있습니다.</p>';return}renderStudentCoachingCard();
}
function renderStudentCoachingCard(){
  const target=$('#studentCoachingContent'),key=coachingKey();if(!target||!key)return;
  const state=studentCoachingState.get(key)||{},data=state.data,card=data?.card,escape=escapeHTML;
  if(state.loading&&!data){target.innerHTML='<p role="status">저장된 코칭 카드를 확인하고 있습니다…</p>';return}
  const error=state.error?`<p class="coaching-error" role="alert">${escape(state.error)}</p><button type="button" class="text-button" data-coaching-reload>다시 불러오기</button>`:'';
  if(!data){target.innerHTML=error||'<p>학생 코칭 탭을 열면 저장된 카드를 확인합니다.</p>';return}
  const refs=values=>{const ids=[...new Set(values||[])];if(ids.length===1)return `<button type="button" class="text-button coaching-single-ref" data-coaching-source="${escape(ids[0])}">근거 1건 · 원문 보기</button>`;return ids.length?`<details class="coaching-refs"><summary>근거 ${ids.length}건</summary><div>${ids.map(ref=>{const source=data.sources?.find(row=>row.id===ref);return source?`<button type="button" class="text-button" data-coaching-source="${escape(ref)}">${escape(monthLabel(source.month))} · ${escape(source.label)}<small>${escape(source.type)}</small></button>`:''}).join('')}</div></details>`:''};
  const item=value=>`<p>${escape(aiTeacherDisplayText(value.text))}</p>${refs(value.refs)}`;
  const result=card?.result,feedback=(data.feedback||[]).find(row=>row.card_id===card?.id),statusLabels={not_tried:'아직 시도 전',helpful:'도움 됨',needs_change:'다른 방법 필요'};
  const draft=studentCoachingDrafts.get(key),outcome=draft?.status||feedback?.status||'not_tried',draftNote=draft?.note??feedback?.note??'';
  const busy=state.generating||state.loading||state.saving;
  target.innerHTML=`<div class="panel-head relationship-ai-head coaching-ai-head"><h3>학생 코칭 카드</h3><div class="ai-review-actions"><button type="button" class="text-button" data-coaching-reload ${busy?'disabled':''}>${state.loading?'불러오는 중…':'저장된 결과 불러오기'}</button><button type="button" class="text-button" data-coaching-generate ${busy||!data.canGenerate||data.remaining<=0?'disabled':''}>${state.generating?'AI 분석 중…':'AI 새 분석'}</button></div></div>
    <div class="coaching-meta"><span>${escape(data.basisMonth?monthLabel(data.basisMonth):'자료 없음')} 자료 기준 · 남은 생성 ${Number(data.remaining)||0} / 100회</span><span>새 분석: 외부 AI 전송 · 1회 사용</span></div>
    <details class="coaching-disclosure coaching-info"><summary>분석 범위·전송 안내</summary><p class="coaching-scope">최근 12개월 내 본인의 최신 4회 설문 중 고민·도움 요청·자기평가 등, 최근 교사 기록 최대 6회, 본인 응답이 있는 달의 받은 관계 점수를 참고합니다. 모든 과거 응답·문항을 분석하는 것은 아니며, 근거별 본문은 최대 500자까지 참고합니다.</p><p>등록된 학생 이름·이메일·휴대전화번호를 가린 응답·교사 기록을 외부 AI로 전송합니다. 그 밖의 개인정보는 기록에 포함하지 마세요.</p><p>학급당 월 100회(실패한 요청 포함). 저장 결과 조회는 차감하지 않습니다. 새 분석에는 외부 AI 비용이 발생합니다.</p></details>
    ${error}${data.stale?'<div class="notice warning"><p>자료 또는 카드 형식이 변경되어 이전 카드를 숨겼습니다. 현재 자료로 다시 생성해 주세요.</p></div>':''}
    ${data.limited?'<p class="coaching-limited">자료가 적습니다. 해석보다 확인 질문을 중심으로 참고하세요.</p>':''}
    ${result?`<div class="coaching-workbench"><div class="coaching-focus"><section class="coaching-summary"><h4>이번 코칭의 초점</h4>${item(result.summary)}</section>
    <section class="coaching-question"><h4>학생에게 건넬 말</h4><blockquote>${escape(aiTeacherDisplayText(result.question.text))}</blockquote>${refs(result.question.refs)}</section></div>
    <section class="coaching-action-section"><h4>교사가 해볼 일</h4><div class="coaching-actions-grid">${result.actions.map((action,index)=>`<article class="coaching-action"><h5><span>${index+1}</span>${escape(aiTeacherDisplayText(action.title))}</h5><ol>${action.steps.map(step=>`<li>${escape(aiTeacherDisplayText(step))}</li>`).join('')}</ol>${refs(action.refs)}</article>`).join('')}</div></section></div>
    <section class="coaching-followup"><h4>다음에 확인할 점</h4><p>${escape(aiTeacherDisplayText(result.check_after))}</p></section>
    <details class="coaching-disclosure coaching-analysis"><summary>분석 근거 살펴보기</summary><div class="coaching-columns"><section><h4>학생이 표현한 모습과 바람</h4><p class="muted">자기평가와 바람은 교사가 확인한 행동과 다릅니다.</p>${result.strengths.length?result.strengths.map(item).join(''):'<p>관련 단서가 충분하지 않습니다.</p>'}</section><section><h4>추가로 확인할 어려움</h4>${result.needs.length?result.needs.map(item).join(''):'<p>현재 근거만으로 특정 어려움을 제안하지 않습니다.</p>'}</section></div><h4>해석할 때 주의할 점</h4><ul>${result.limitations.filter(value=>String(value).trim()&&!/^[-·•\\s]+$/.test(value)).map(value=>`<li>${escape(aiTeacherDisplayText(value))}</li>`).join('')}</ul><p class="muted">학생 유형·성격 진단이 아닌 교사용 초안입니다.</p></details>
    <details class="coaching-disclosure coaching-feedback" ${state.saving||draft?'open':''}><summary>적용 결과 기록 <span>${escape(statusLabels[outcome]||'아직 시도 전')}</span></summary><p class="muted">관찰한 사실을 기록해 주세요. 지도 효과를 확정하는 평가는 아닙니다.</p><fieldset class="coaching-outcomes"><legend>적용 상태</legend>${Object.entries(statusLabels).map(([value,label])=>`<label><input type="radio" name="studentCoachingOutcome" value="${value}" ${value===outcome?'checked':''} ${state.saving?'disabled':''}><span>${label}</span></label>`).join('')}</fieldset><details class="coaching-note" ${draftNote?'open':''}><summary>메모 남기기 (선택)</summary><label>관찰한 변화나 다음에 시도할 점<textarea id="studentCoachingNote" maxlength="1000" rows="3" ${state.saving?'disabled':''}>${escape(draftNote)}</textarea></label></details>${draft?'<p class="muted">아직 저장하지 않은 내용입니다. 학생 전환·결과 불러오기 중에는 유지되며 새로고침·로그아웃 시 삭제됩니다.</p>':''}<button type="button" class="secondary-button" data-coaching-feedback ${state.saving?'disabled':''}>${state.saving?'저장 중…':'적용 결과 저장'}</button>${feedback?`<p class="muted">저장됨 · ${escape(new Date(feedback.created_at).toLocaleString('ko-KR'))}</p>`:''}</details>
    <details class="coaching-disclosure coaching-more"><summary>분석 정보·더보기</summary><p>생성 ${escape(new Date(card.generatedAt).toLocaleString('ko-KR'))} · ${escape(card.model)} · ${escape(result.version)}</p><button type="button" class="text-button" data-coaching-delete ${busy?'disabled':''}>카드 삭제</button></details>`:
    `<div class="coaching-empty"><h4>${data.canGenerate?'아직 현재 자료의 코칭 카드가 없습니다.':'코칭을 만들 근거가 부족합니다.'}</h4><p>${data.canGenerate?'상단의 AI 새 분석을 누르면 응답 근거에 맞춘 지도 초안을 생성합니다.':'학생과 먼저 대화하고 응답이나 관찰 사실을 남겨 주세요.'}</p></div>`}`;
}
async function loadStudentCoaching(forceReload=false){
  const key=coachingKey();if(!key)return;const state=studentCoachingState.get(key)||{};if(state.loading||state.generating)return;if(state.data&&!forceReload){renderStudentCoachingCard();return}
  const epoch=studentCoachingEpoch,studentId=key.slice(key.lastIndexOf(':')+1),classId=classSettings.classId;studentCoachingState.set(key,{...state,loading:true,error:''});renderStudentCoachingCard();
  try{const data=await teacherEdgeFunction('student-coaching',{classId,studentId,action:'load'});if(epoch!==studentCoachingEpoch||!getTeacherSession())return;studentCoachingState.set(key,{data})}
  catch(error){if(epoch===studentCoachingEpoch)studentCoachingState.set(key,{...state,error:error.message})}
  finally{if(epoch===studentCoachingEpoch&&coachingKey()===key)renderStudentCoachingCard()}
}
document.addEventListener('class-ieum:data-updated',()=>{clearStudentCoachingState();if(activeStudentDetailTab==='coaching')loadStudentCoaching()});
document.addEventListener('input',event=>{if(!event.target.matches('#studentCoachingNote,input[name="studentCoachingOutcome"]'))return;const key=coachingKey();if(!key)return;studentCoachingDrafts.set(key,{status:$('input[name="studentCoachingOutcome"]:checked')?.value||'not_tried',note:$('#studentCoachingNote')?.value||''})});

document.addEventListener('click',async event=>{
  const sourceButton=event.target.closest('[data-coaching-source]'),key=coachingKey(),state=studentCoachingState.get(key);if(!key)return;
  if(sourceButton){const source=state?.data?.sources.find(source=>source.id===sourceButton.dataset.coachingSource);if(!source)return;const container=$('#studentCoachingSource');container.replaceChildren();const heading=document.createElement('h3'),meta=document.createElement('p'),value=document.createElement('p');heading.textContent=source.label;meta.textContent=`${monthLabel(source.month)} · ${source.type}`;value.textContent=source.value;value.className='coaching-original';container.append(heading,meta,value);$('#studentCoachingEvidence').showModal();return}
  if(event.target.closest('[data-coaching-reload]')){loadStudentCoaching(true);return}
  const generate=event.target.closest('[data-coaching-generate]'),save=event.target.closest('[data-coaching-feedback]'),remove=event.target.closest('[data-coaching-delete]');if(!generate&&!save&&!remove)return;if(!state?.data||state.generating||state.saving)return;
  if(remove&&!confirm('이 코칭 카드와 카드의 적용 결과를 삭제할까요? 학생 설문과 기존 관찰 기록은 유지됩니다.'))return;
  const epoch=studentCoachingEpoch,studentId=key.slice(key.lastIndexOf(':')+1),classId=classSettings.classId,status=$('input[name="studentCoachingOutcome"]:checked')?.value,note=$('#studentCoachingNote')?.value||'';
  studentCoachingState.set(key,{...state,generating:!!generate,saving:!generate,error:''});renderStudentCoachingCard();
  try{
    if(generate){const data=await teacherEdgeFunction('student-coaching',{classId,studentId,action:'generate',force:true});if(epoch===studentCoachingEpoch&&getTeacherSession()){studentCoachingState.set(key,{data});showToast(data.cached?'저장된 코칭 카드를 불러왔습니다.':'학생 코칭 카드를 저장했습니다.')}}
    else{await teacherRpc(remove?'teacher_delete_student_coaching_auth':'teacher_record_student_coaching_feedback_auth',{p_class_id:classId,p_card_id:state.data.card.id,...(remove?{}:{p_status:status,p_note:note})});if(epoch===studentCoachingEpoch&&getTeacherSession()){studentCoachingDrafts.delete(key);studentCoachingState.delete(key);if(coachingKey()===key)await loadStudentCoaching(true);showToast(remove?'코칭 카드와 적용 결과를 삭제했습니다.':'적용 결과를 저장했습니다.')}}
  }catch(error){if(epoch===studentCoachingEpoch)studentCoachingState.set(key,{...state,error:error.message})}
  finally{if(epoch===studentCoachingEpoch&&coachingKey()===key)renderStudentCoachingCard()}
});
