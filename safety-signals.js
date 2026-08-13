const clearSensitiveStateBeforeSignalInbox=clearSensitiveState;
clearSensitiveState=()=>{signalReviews=[];clearSensitiveStateBeforeSignalInbox()};

function enhanceSignalObservationLinks(){
  $$('#signalReviewInbox [data-signal-key]').forEach(card=>{if(card.querySelector('[data-start-signal-observation]'))return;const signal=signals.find(item=>signalKey(item)===card.dataset.signalKey),review=signal&&signalReviewFor(signal);if(!review?.id)return;const existing=getObservations().find(item=>item.signalReviewId===review.id),button=document.createElement('button');button.type='button';button.className='evidence-button signal-observation-button';button.dataset.startSignalObservation=signal.id;button.textContent=existing?'연결된 관찰 열기':'관찰 확인 시작';card.querySelector('.signal-source-button')?.after(button)})
}
document.addEventListener('class-ieum:data-updated',enhanceSignalObservationLinks);

document.addEventListener('click',async event=>{
  const filterButton=event.target.closest('[data-signal-review-filter]');
  if(filterButton){signalReviewFilter=filterButton.dataset.signalReviewFilter;renderSignalInbox();return}
  const evidenceButton=event.target.closest('[data-review-evidence]');
  if(evidenceButton){openEvidence(evidenceButton.dataset.reviewEvidence);$('#saveObservation').hidden=true;return}
  const observationButton=event.target.closest('[data-start-signal-observation]');
  if(observationButton){const signal=signals.find(item=>String(item.id)===observationButton.dataset.startSignalObservation),review=signal&&signalReviewFor(signal);if(!signal||!review)return;const existing=getObservations().find(item=>item.signalReviewId===review.id);openObservationForm(existing||{studentId:signal.studentId,studentNumber:signal.studentNumber,student:signal.name,title:signal.title,detail:signal.observation,followUpDate:review.follow_up_date||'',sourceType:'rule_signal',sourceSnapshot:{signalKey:signalKey(signal),signalReviewId:review.id,evidence:signal.evidence},signalReviewId:review.id});return}
  const button=event.target.closest('[data-save-signal-review]');
  if(!button)return;
  const signal=signals.find(item=>String(item.id)===button.dataset.saveSignalReview);
  const card=button.closest('[data-signal-key]');
  if(!signal||!card)return;
  button.disabled=true;
  try{
    await teacherRpc('teacher_upsert_signal_review_auth',{
      p_class_id:classSettings.classId,
      p_signal:{
        signalKey:signalKey(signal),studentId:signal.studentId,studentNumber:signal.studentNumber,
        sourceResponseId:signal.sourceResponseId,signalType:signal.type,
        status:card.querySelector('[data-signal-review-status]').value,
        note:card.querySelector('[data-signal-review-note]').value.trim(),
        followUpDate:card.querySelector('[data-signal-review-date]').value,
        sourceSnapshot:{month:selectedAnalysisMonth,title:signal.title,summary:signal.summary,evidence:signal.evidence}
      }
    });
    await refreshSignalReviews();
    renderSignalInbox();
    document.dispatchEvent(new CustomEvent('class-ieum:data-updated'));
    showToast('안전 신호 확인 상태를 저장했습니다.');
  }catch(error){showToast(`상태 저장 실패: ${error.message}`)}finally{button.disabled=false}
});
