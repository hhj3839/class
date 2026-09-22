// Numeric survey evidence only; never forward peers' names or narrative answers.
export function relationshipContext(context,normalizer,compare){
  if(!compare)return [];
  const student=context.student,number=Number(student.number),roster=context.roster||[];
  const identities=new Map(roster.map(s=>[Number(s.number),s.studentId||s.student_id]));
  const rows=normalizer.normalizeResponses(context.responses||[],roster).filter(row=>row.student_id&&row.student_id===identities.get(row.student_number));
  const own=rows.filter(row=>row.student_id===student.studentId).sort((a,b)=>b.survey_month.localeCompare(a.survey_month));
  const month=own[0]?.survey_month.slice(0,7),transfer=student.transferredOn||student.transferred_on;
  if(!month||(transfer&&month>=transfer.slice(0,7)))return [];
  const comparison=compare(rows,roster.map(s=>Number(s.number)===number?{...s,...student}:s),month,normalizer),summary=comparison.byStudent.get(number);
  if(!summary)return [];
  const result=[];
  for(const period of [comparison.previousMonth,month]){
    const periodRows=rows.filter(row=>row.survey_month.slice(0,7)===period);
    if(!periodRows.some(row=>row.student_id===student.studentId))continue;
    const pairs=normalizer.buildEvidence(periodRows,roster).pairs.filter(pair=>pair.a===number||pair.b===number),observed=pairs.filter(pair=>pair.commonMonths.length).length,positive=pairs.filter(pair=>pair.positiveMonths.length).length;
    result.push({month:period,label:'같은 달 관계 관측',field:'relationship_context',value:`같은 달 양방향 응답 ${observed}명 중 서로 높은 평가 ${positive}명. 양방향 미관측 ${pairs.length-observed}명. 높은 평가는 서로 4점 이상인 응답 기준이며 실제 친구 수가 아닙니다.`,responseIds:periodRows.filter(row=>row.student_number===number||row.payload_json.relationships.some(item=>item.targetNumber===number)).map(row=>row.id).filter(Boolean)});
  }
  const latest=result.find(source=>source.month===month);
  if(latest){
    latest.responseIds=[...new Set(result.flatMap(source=>source.responseIds))];
    latest.label='같은 달 관계 관측과 직전 달 비교';
    latest.value+=summary.comparable?` 직전 달과 같은 학생·양방향 응답이 확인된 ${summary.comparable}명만 비교: 새 기준 충족 ${summary.new.length}명, 유지 ${summary.continued.length}명, 기준 미충족 ${summary.below.length}명.`:' 직전 달 비교 가능한 관계가 없어 변화 해석 보류.';
    latest.value+=` 비교 보류: 응답 부족 ${summary.missing.length}명, 학생 식별 ${summary.identity.length}명, 전출 기간 ${summary.enrollment.length}명. 전입일 및 다른 학생의 재적 이력은 완전히 반영되지 않습니다.`;
  }
  result.forEach(source=>{if(source.month!==month)source.label='같은 달 관계 관측';});
  return result;
}
