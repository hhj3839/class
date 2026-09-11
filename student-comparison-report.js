// 분석 제외/삭제 응답을 빼고 월별 마지막 제출을 사용합니다. 미참여는 0점이 아닙니다.
function buildStudentOverviewPdfReport(student,{includeNames=true,includeOriginals=false}={},coachingSection=''){
  const escape=value=>escapeHTML(String(value??'')),monthly=studentMonthlyResponses(student.number),latest=monthly.at(-1),relation=latest?incomingRelationshipFor(student.number,latest.month):null,mentions=latest?receivedPositiveMentions(student,latest.month).length:0,payload=latest?payloadOf(latest.item):{};
  const card=(title,body)=>`<article class="pdf-block pdf-coaching-compact"><h3>${escape(title)}</h3><p>${body}</p></article>`;
  const excerpt=value=>{const text=String(value||'').trim();return escape(text.length>180?text.slice(0,180)+'…':text)};
  return `<header><h1>${escape(includeNames?student.name:'선택 학생')} 학생 기록</h1><p>${escape(classSettings.schoolYear)}학년도 · 최근 응답 ${escape(latest?.month||'없음')}</p></header><section class="pdf-ai-section"><section class="pdf-block pdf-comparison-heading"><h2>학생 한눈에 보기</h2></section>${card('친구 관계 점수 평균',relation?`${relation.average.toFixed(1)}점 / 5점 · 친구 ${relation.count}명 응답`:'비교할 수 있는 친구 관계 평가가 없습니다.')}${card('긍정적인 친구 언급',`${mentions}건 · 최근 응답 달의 친절·존중 및 긍정적 변화 문항 기준`)}${includeNames&&includeOriginals&&payload.studentState?.worryDetail?card('최근 학교생활 고민',excerpt(payload.studentState.worryDetail)):''}${includeNames&&includeOriginals&&payload.helpNow?card('최근 도움 요청',excerpt(payload.helpNow)):''}</section>${coachingSection}<p class="pdf-block pdf-comparison-note">학생 지원을 위한 교사용 참고 자료이며 진단이 아닙니다. 긴 내용은 발췌해 …로 표시합니다.</p>`;
}
function studentReportComparison(student,responses,observations=[]){
  const payload=row=>{try{return typeof row.payload_json==='string'?JSON.parse(row.payload_json):row.payload_json||{}}catch{return{}}};
  const month=row=>String(row.survey_month||'').slice(0,7);
  const belongs=row=>row.student_id&&student.studentId?row.student_id===student.studentId:Number(row.student_number)===Number(student.number);
  const valid=responses.filter(row=>!row.deleted_at&&!row.analysis_excluded&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month(row)));
  const monthly=new Map();
  for(const row of valid.slice().sort((a,b)=>String(b.submitted_at||'').localeCompare(String(a.submitted_at||'')))){
    const key=`${month(row)}:${row.student_id||row.student_number}`;if(!monthly.has(key))monthly.set(key,row);
  }
  const rows=[...monthly.values()],own=rows.filter(belongs).sort((a,b)=>month(a).localeCompare(month(b))),latest=own.at(-1);
  if(!latest)return{latestMonth:null,previous:[],latest:null,relation:{before:null,recent:null},observations:{before:[],recent:[]}};
  const latestMonth=month(latest),previous=own.filter(row=>month(row)<latestMonth),months=[...new Set(rows.map(month).filter(value=>value<latestMonth))].sort();
  const scores=m=>rows.filter(row=>month(row)===m&&!belongs(row)).flatMap(row=>{const entry=(payload(row).relationships||[]).find(value=>Number(value.targetNumber)===Number(student.number));const score=Number(entry?.score);return Number.isFinite(score)&&score>=1&&score<=5?[score]:[]});
  const metric=m=>{const values=scores(m);return values.length?{average:values.reduce((a,b)=>a+b,0)/values.length,count:values.length}:null};
  const metrics=months.map(metric).filter(Boolean);
  const matched=observations.filter(row=>!row.deleted_at&&(row.studentId&&student.studentId?row.studentId===student.studentId:Number(row.studentNumber)===Number(student.number))&&/^\d{4}-\d{2}$/.test(row.surveyMonth||''));
  return{latestMonth,latest:payload(latest),previous:previous.map(row=>({month:month(row),payload:payload(row)})),relation:{recent:metric(latestMonth),before:metrics.length?{average:metrics.reduce((n,row)=>n+row.average,0)/metrics.length,months:metrics.length,count:metrics.reduce((n,row)=>n+row.count,0)}:null},observations:{before:matched.filter(row=>row.surveyMonth<latestMonth),recent:matched.filter(row=>row.surveyMonth===latestMonth)}};
}
function buildStudentComparisonReport(student,{includeNames=true,includeOriginals=false}={},coachingSection=''){
  const data=studentReportComparison(student,allResponses,getObservations()),escape=value=>escapeHTML(String(value??'')),short=value=>{const text=String(value||'').trim();return escape(text.length>100?text.slice(0,100)+'…':text)},hasText=includeNames&&includeOriginals;
  const header=`<header><h1>${escape(includeNames?student.name:'선택 학생')} 기록 비교</h1><p>최근 응답 ${escape(data.latestMonth||'없음')} · 이전 본인 응답 ${data.previous.length}개월${data.previous.length?` (${escape(data.previous[0].month)}부터)`:''}</p></header>`;
  if(!data.latest)return `${header}<p class="pdf-block">비교할 학생 응답이 없습니다. 자료 부족은 어려움이나 악화를 뜻하지 않습니다.</p>`;
  const cells=(title,before,recent,change)=>`<article class="pdf-block pdf-comparison-card"><h3>${escape(title)}</h3><table><thead><tr><th>이전 기록</th><th>최근 ${escape(data.latestMonth)}</th></tr></thead><tbody><tr><td>${before}</td><td>${recent}</td></tr></tbody></table><p class="pdf-comparison-change"><b>변화 확인</b> ${change}</p></article>`;
  const value=key=>key==='worry'?data.latest.studentState?.worryDetail:data.latest.helpNow;
  const narrative=key=>{
    const records=data.previous.map(row=>({month:row.month,text:String(key==='worry'?row.payload.studentState?.worryDetail||'':row.payload.helpNow||'').trim()})).filter(row=>row.text);
    const groups=new Map();for(const row of records){const found=groups.get(row.text)||{...row,count:0};found.count++;groups.set(row.text,found)}
    const top=[...groups.values()].sort((a,b)=>b.count-a.count||b.month.localeCompare(a.month)).slice(0,2),recent=String(value(key)||'').trim();
    return cells(key==='worry'?'학교생활 고민':'도움 요청',hasText?(top.map(row=>`${short(row.text)} (${row.count}개월)`).join('<br>')||'작성 기록 없음'):`작성 ${records.length}개월`,hasText?(short(recent)||'작성 내용 없음'):(recent?'작성 있음':'작성 없음'),!data.previous.length?'이전 자료 없음':recent?(groups.has(recent)?`이전 ${groups.get(recent).count}개월과 동일 문구`:'이전과 동일 문구 없음 · 직접 확인'):'미작성만으로 해결 여부 판단 불가');
  };
  const {before,recent}=data.relation,format=row=>row?`${row.average.toFixed(2)} / 5<br>${row.months?`${row.months}개월 · `:''}${row.count}개 평가`:'유효 평가 없음',delta=before&&recent?recent.average-before.average:null;
  const observed=rows=>hasText?(rows.filter(row=>row.observedFact).slice().sort((a,b)=>String(b.surveyMonth).localeCompare(String(a.surveyMonth))).slice(0,2).map(row=>`${escape(row.surveyMonth)}: ${short(row.observedFact)}`).join('<br>')||'확인한 사실 기록 없음'):`기록 ${rows.length}건`;
  const table=`<section class="pdf-ai-section"><section class="pdf-block pdf-comparison-heading"><h2>최근 달과 이전 누적 기록</h2></section>${cells('받은 관계 평가',format(before),format(recent),delta===null?'변화 판단 어려움':`${delta>0?'+':''}${delta.toFixed(2)}점 · 평가자 구성 차이 고려`)}${narrative('worry')}${narrative('help')}${cells('교사 관찰',observed(data.observations.before),observed(data.observations.recent),'기록 유무를 행동 변화로 판단하지 않음')}</section>`;
  return `${header}${table}<p class="pdf-block pdf-comparison-note">이전 전체 월 기준 · 관계 점수는 월평균들의 평균 · 미참여 제외 · 문구 비교는 해결 여부 판단이 아닙니다.${hasText?' 이전 서술·관찰은 대표 2개씩 발췌(긴 내용은 … 표시).':' 서술 원문 제외.'}</p>${coachingSection}<p class="pdf-block pdf-comparison-note">학생 지원을 위한 교사용 참고 자료이며 진단이 아닙니다.</p>`;
}
