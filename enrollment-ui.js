function clearEnrollmentDialog(){const dialog=$('#studentTransferDialog');if(!dialog)return;dialog.close();delete dialog.dataset.studentId;delete dialog.dataset.cancelTransfer;$('#studentTransferTitle').textContent='전출 처리';$('#studentTransferDescription').textContent='';$('#studentTransferError').textContent='';$('#studentTransferDate').value=''}
function studentDetailRoster(){return classSettings.students.filter(student=>$('#includeTransferredStudents')?.checked||!IeumEnrollment.transferDate(student))}
document.addEventListener('change',event=>{if(event.target.id==='includeTransferredStudents'){renderStudentDetailSelector();renderStudentDetail()}});
function renderEnrollmentControls(){
  const students=classSettings.students,transferred=students.filter(student=>IeumEnrollment.transferDate(student));
  $('#rosterCount').textContent=`재학 ${students.length-transferred.length}명 · 전출 ${transferred.length}명`;
  $$('#rosterBody tr').forEach((row,index)=>{
    const student=students[index],date=IeumEnrollment.transferDate(student),cell=row.lastElementChild;
    row.classList.toggle('student-transferred',Boolean(date));
    if(date){const label=document.createElement('small');label.className='student-transfer-label';label.textContent='전출';const dateLabel=document.createElement('span');dateLabel.textContent=date;label.append(dateLabel);row.children[1].append(label);cell.replaceChildren()}
    const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.transferStudent=String(index);button.textContent=date?'전출 취소':'전출';button.disabled=!student.studentId;button.title=student.studentId?'':'먼저 학생 명단을 DB에 저장해 주세요.';cell.prepend(button);
  });
}
function openStudentTransfer(index){
  const student=classSettings.students[index];if(!student?.studentId)return;
  const form=collectSettingsForm();
  if(JSON.stringify(form.students.map(({number,name})=>({number,name})))!==JSON.stringify(classSettings.students.map(({number,name})=>({number,name})))){showToast('수정 중인 학생 명단을 먼저 저장해 주세요.');return}
  const dialog=$('#studentTransferDialog'),date=IeumEnrollment.transferDate(student),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  dialog.dataset.studentId=student.studentId;dialog.dataset.cancelTransfer=date?'true':'false';
  $('#studentTransferTitle').textContent=`${student.name} · ${date?'전출 취소':'전출 처리'}`;
  $('#studentTransferDate').value=date||today;$('#studentTransferDate').max=today;$('#studentTransferDate').disabled=Boolean(date);
  $('#studentTransferDescription').textContent=date?'전출 상태를 취소하고 학생 설문 참여를 다시 허용합니다. 기존 자료는 그대로 유지됩니다.':'선택한 날짜부터 전출 처리합니다. 학생 설문에서 제외하고, 전출한 달의 미참여는 미제출로 집계하지 않습니다. 이전 응답과 관찰 기록은 보존됩니다.';
  $('#studentTransferError').textContent='';$('#confirmStudentTransfer').textContent=date?'전출 취소하기':'전출 처리하기';dialog.showModal();
}
document.addEventListener('click',async event=>{
  const trigger=event.target.closest('[data-transfer-student]');if(trigger){openStudentTransfer(Number(trigger.dataset.transferStudent));return}
  if(!event.target.closest('#confirmStudentTransfer'))return;
  const dialog=$('#studentTransferDialog'),input=$('#studentTransferDate'),button=$('#confirmStudentTransfer'),cancel=dialog.dataset.cancelTransfer==='true';
  if(!cancel&&!input.reportValidity())return;
  button.disabled=true;$('#studentTransferError').textContent='';
  try{await teacherRpc('teacher_set_student_transfer_auth',{p_class_id:classSettings.classId,p_student_id:dialog.dataset.studentId,p_transferred_on:cancel?null:input.value});dialog.close();await loadTeacherContext();showToast(cancel?'전출을 취소했습니다.':'전출 처리했습니다. 이전 자료는 보존됩니다.')}
  catch(error){$('#studentTransferError').textContent=/teacher_set_student_transfer_auth|schema cache|function.*not.*exist/i.test(error.message)?'전출 기능 DB 설정이 아직 적용되지 않았습니다. 20260909120000_student_transfer_status.sql을 Supabase SQL Editor에서 실행해 주세요.':`처리 실패: ${error.message}`}
  finally{button.disabled=false}
});
