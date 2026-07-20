const clearSensitiveStateBeforeSignalInbox=clearSensitiveState;
clearSensitiveState=()=>{signalReviews=[];clearSensitiveStateBeforeSignalInbox()};

document.addEventListener('click',async event=>{
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
    showToast('안전 신호 확인 상태를 저장했습니다.');
  }catch(error){showToast(`상태 저장 실패: ${error.message}`)}finally{button.disabled=false}
});
