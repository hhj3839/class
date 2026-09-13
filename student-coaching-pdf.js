// PDF에서는 저장 결과만 조회합니다. 생성 요청이나 사용량 차감은 하지 않습니다.
function buildStudentCoachingPdfSection(data,{includeNames=true}={}){
  return buildCompactCoachingPdf(data,{includeNames});
}
function buildCompactCoachingPdf(data,{includeNames}){
  if(!includeNames||data?.stale||!data?.card?.result)return '';
  const escape=value=>escapeHTML(String(value??'')),short=value=>{const text=String(value||'');return escape(text)},result=data.card.result;
  const refs=ids=>[...new Set(ids||[])].map(id=>data.sources?.find(row=>row.id===id)).filter(row=>row&&row.kind!=='observation'&&!/^교사/.test(row.type||'')).slice(0,2).map(row=>`${escape(row.month)} · ${escape(row.label)}`).join(' / ');
  const block=(title,text,ids)=>`<article class="pdf-block pdf-coaching-compact"><h3>${escape(title)}</h3><p>${text}</p>${refs(ids)?`<small>근거: ${refs(ids)}</small>`:''}</article>`;
  return `<section class="pdf-ai-section"><section class="pdf-block pdf-coaching-page-heading" data-pdf-page-start><h2>학생 코칭</h2><p>저장된 학생 설문 기준의 대화 초안입니다. 전체 이력을 새로 분석한 결과는 아닙니다.</p>${data.previousGuidance?'<p>이전 대화 지침으로 생성되었으며 현재 안전·근거 검사를 통과한 카드입니다.</p>':''}</section>${block('함께 탐색할 주제',short(result.summary?.text),result.summary?.refs)}${block('대화를 여는 질문',short(result.question?.text),result.question?.refs)}${(result.actions||[]).slice(0,3).map(action=>block(`답에 따라 이어갈 대화: ${action.title}`,(action.steps||[]).slice(0,2).map(short).join('<br>'),action.refs)).join('')}${block('대화 마무리',short(result.check_after).replace(/\r?\n/g,'<br>'))}</section>`;
}
async function loadStudentCoachingPdfSection(student,options){
  if(!options.includeNames||!student?.studentId)return buildStudentCoachingPdfSection(null,options);
  const epoch=studentCoachingEpoch,classId=classSettings.classId;
  const data=await teacherEdgeFunction('student-coaching',{classId,studentId:student.studentId,action:'load'});
  if(epoch!==studentCoachingEpoch||classId!==classSettings.classId||!getTeacherSession())throw new Error('로그인 또는 학급 자료가 변경되었습니다. PDF를 다시 요청해 주세요.');
  return buildStudentCoachingPdfSection(data,options);
}
