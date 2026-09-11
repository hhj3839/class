// PDF에서는 저장 결과만 조회합니다. 생성 요청이나 사용량 차감은 하지 않습니다.
function buildStudentCoachingPdfSection(data,{includeNames=true,includeOriginals=false,compact=false}={}){
  if(compact)return buildCompactCoachingPdf(data,{includeNames});
  const escape=value=>escapeHTML(String(value??''));
  const block=(title,body)=>`<article class="pdf-block pdf-coaching-block"><h3>${escape(title)}</h3>${body}</article>`;
  const heading='<section class="pdf-block pdf-section-heading"><h2>학생 코칭 카드</h2><p>저장된 교사용 지도 초안입니다. 학생 유형·성격 진단이나 사실 판정이 아닙니다.</p></section>';
  if(!includeNames)return `<section class="pdf-ai-section">${heading}${block('코칭 내용 제외','<p>이름 제외 보고서에서는 서술 내용에 포함될 수 있는 개인정보 보호를 위해 코칭과 적용 결과를 생략했습니다.</p>')}</section>`;
  if(data?.stale||!data?.card?.result)return `<section class="pdf-ai-section">${heading}${block('저장된 코칭 없음',`<p>${data?.stale?'자료가 변경된 이전 코칭은 포함하지 않았습니다.':'현재 자료의 저장된 코칭 카드가 없습니다.'} PDF 저장은 새 AI 분석을 실행하지 않습니다.</p>`)}</section>`;
  const card=data.card,result=card.result,sources=data.sources||[],used=new Map();
  const refs=ids=>{const labels=[];for(const id of new Set(ids||[])){const source=sources.find(row=>row.id===id);if(!source)continue;if(!used.has(id))used.set(id,{number:used.size+1,source});labels.push(`[${used.get(id).number}]`)}return labels.length?`<p class="pdf-coaching-reference">근거 ${labels.join(' ')}</p>`:''};
  const text=value=>escape(typeof aiTeacherDisplayText==='function'?aiTeacherDisplayText(value||''):value||'');
  const item=value=>`<p>${text(value?.text)}</p>${refs(value?.refs)}`;
  const sections=[heading,block('분석 정보',`<p>자료 기준 ${escape(card.basisMonth||data.basisMonth||'확인 불가')} · 생성 ${escape(card.generatedAt?new Date(card.generatedAt).toLocaleString('ko-KR'):'확인 불가')}</p><p>최근 12개월 내 최신 4회 설문의 일부 문항·교사 기록 최대 6회·관계 계산값 참고. 전체 과거 응답을 분석한 결과는 아닙니다.</p>`),block('이번 코칭의 초점',item(result.summary)),block('학생에게 건넬 말',item(result.question))];
  (result.actions||[]).forEach((action,index)=>sections.push(block(`교사가 해볼 일 ${index+1}: ${action.title}`,`<ol>${(action.steps||[]).map(step=>`<li>${text(step)}</li>`).join('')}</ol>${refs(action.refs)}`)));
  sections.push(block('다음에 확인할 점',`<p>${text(result.check_after)}</p>`));
  for(const [label,items] of [['학생이 표현한 모습과 바람',result.strengths],['추가로 확인할 어려움',result.needs]])(items||[]).forEach(value=>sections.push(block(label,item(value))));
  const limitations=(result.limitations||[]).filter(value=>String(value).trim()&&!/^[-·•\s]+$/.test(value));
  if(limitations.length)sections.push(block('해석할 때 주의할 점',`<ul>${limitations.map(value=>`<li>${text(value)}</li>`).join('')}</ul>`));
  const feedback=(data.feedback||[]).filter(row=>row.card_id===card.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
  const labels={not_tried:'아직 시도 전',helpful:'도움 됨',needs_change:'다른 방법 필요'};
  sections.push(block('교사의 적용 결과',feedback?`<p>${escape(labels[feedback.status]||'확인 필요')} · ${escape(new Date(feedback.created_at).toLocaleString('ko-KR'))}</p><p>${escape(feedback.note)}</p><p>교사의 관찰 기록이며 지도 효과를 확정하는 평가는 아닙니다.</p>`:'<p>저장된 적용 결과가 없습니다.</p>'));
  for(const {number,source} of used.values())sections.push(block(`근거 [${number}] ${source.label}`,`<p>${escape(source.month)} · ${escape(source.type)}</p>${includeOriginals?`<p>${escape(source.value)}</p>`:'<p>원문 제외 설정에 따라 문항 정보만 표시합니다.</p>'}`));
  return `<section class="pdf-ai-section pdf-coaching-section">${sections.join('')}</section>`;
}
function buildCompactCoachingPdf(data,{includeNames}){
  if(!includeNames||data?.stale||!data?.card?.result)return '';
  const escape=value=>escapeHTML(String(value??'')),short=value=>{const text=String(value||'');return escape(text.length>180?text.slice(0,180)+'…':text)},result=data.card.result;
  const refs=ids=>[...new Set(ids||[])].map(id=>data.sources?.find(row=>row.id===id)).filter(Boolean).slice(0,2).map(row=>`${escape(row.month)} · ${escape(row.label)}`).join(' / ');
  const block=(title,text,ids)=>`<article class="pdf-block"><h3>${escape(title)}</h3><p>${text}</p>${refs(ids)?`<small>근거: ${refs(ids)}</small>`:''}</article>`;
  const feedback=(data.feedback||[]).filter(row=>row.card_id===data.card.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
  return `<section class="pdf-ai-section"><section class="pdf-block"><h2>지도에 참고할 저장 코칭</h2><p>최신 4회 설문 일부·교사 기록 최대 6회 범위의 별도 초안입니다. 위 전체 기간 비교를 AI가 분석한 결과는 아닙니다.</p></section>${block('학생에게 물어볼 말',short(result.question?.text),result.question?.refs)}${(result.actions||[]).slice(0,2).map((action,i)=>block(`지도 방향 ${i+1}: ${action.title}`,(action.steps||[]).slice(0,2).map(short).join('<br>'),action.refs)).join('')}${block('다음에 확인할 점',short(result.check_after))}${feedback?block('교사의 적용 결과',short(feedback.note)):''}</section>`;
}
async function loadStudentCoachingPdfSection(student,options){
  if(!options.includeNames||!student?.studentId)return buildStudentCoachingPdfSection(null,options);
  const epoch=studentCoachingEpoch,classId=classSettings.classId;
  const data=await teacherEdgeFunction('student-coaching',{classId,studentId:student.studentId,action:'load'});
  if(epoch!==studentCoachingEpoch||classId!==classSettings.classId||!getTeacherSession())throw new Error('로그인 또는 학급 자료가 변경되었습니다. PDF를 다시 요청해 주세요.');
  return buildStudentCoachingPdfSection(data,options);
}
