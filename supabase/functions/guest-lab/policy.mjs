export const CLASS_ID='demo-aa891ab949014621';
export const LAB_EMAIL='applicant-test@hhj3839.dev';
export const READS=new Set(['teacher_get_class_context_auth','teacher_get_responses_auth','teacher_get_signal_reviews_auth']);
export function guestOperation(body){
  if(!body||typeof body!=='object')throw new Error('지원하지 않는 요청입니다.');
  const p=body.payload||{};
  if((p.classId&&p.classId!==CLASS_ID)||(p.p_class_id&&p.p_class_id!==CLASS_ID))throw new Error('가상 학급만 볼 수 있습니다.');
  if(body.kind==='status')return {kind:'status'};
  if(body.kind==='rpc'&&body.name==='teacher_get_my_classes')return {kind:'classes'};
  if(body.kind==='rpc'&&READS.has(body.name))return {kind:'rpc',name:body.name,payload:{p_class_id:CLASS_ID}};
  if(body.kind==='edge'&&body.name==='analyze-class'){
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(p.month||'')||!['class','relationship'].includes(p.analysisType||'class'))throw new Error('분석 기준을 확인해 주세요.');
    return {kind:'edge',name:body.name,charge:p.force===true?'analysis':null,payload:{classId:CLASS_ID,month:p.month,analysisType:p.analysisType||'class',force:p.force===true}};
  }
  if(body.kind==='edge'&&body.name==='student-coaching'){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.studentId||'')||!['load','generate'].includes(p.action))throw new Error('학생을 확인해 주세요.');
    return {kind:'edge',name:body.name,charge:p.action==='generate'?'coaching':null,payload:{classId:CLASS_ID,studentId:p.studentId,action:p.action,force:p.action==='generate'}};
  }
  throw new Error('가상 학급에서는 자료 수정·삭제를 할 수 없습니다.');
}
export function publicContext(value){
  return {classId:CLASS_ID,teacherName:'가상 학급',schoolYear:value.schoolYear,grade:value.grade,classNumber:value.classNumber,
    students:(value.students||[]).map(s=>({number:s.number,name:s.name,studentId:s.studentId||s.student_id,transferredOn:s.transferredOn||null}))};
}
