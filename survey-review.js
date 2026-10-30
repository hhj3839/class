(function(root){
  'use strict';
  const fields={helpNow:'도움 요청','studentState.worryDetail':'학교생활 고민','peerObservations.hurt.detail':'상처를 준 말과 행동','peerObservations.needsHelp.detail':'도움이 필요한 친구','unresolved.detail':'속상한 마음이 남은 관계','studentState.parentWish':'부모님께 바라는 점','studentState.teacherWish':'선생님께 듣고 싶은 말','selfRatings.study.reason':'학습 자기평가 이유','selfRatings.listening.reason':'경청 자기평가 이유','selfRatings.respect.reason':'관계 존중 자기평가 이유','selfRatings.manners.reason':'예의 자기평가 이유','selfRatings.responsibility.reason':'책임감 자기평가 이유','peerObservations.kind.detail':'친절·존중 친구','peerObservations.growth.detail':'긍정적 변화 친구'};
  const empty=value=>/^(?:(?:딱히)?(?:없음|없다|없어요|없습니다|없|해당없음)|없음도움필요없음|x|×|-)$/i.test(value.replace(/[\s.!。]/g,''));
  function collect(rows,month){
    const latest=new Map();
    for(const row of rows||[]){
      if(row.deleted_at||row.analysis_excluded||String(row.survey_month).slice(0,7)!==month)continue;
      const key=Number(row.student_number),before=latest.get(key);
      if(!before||String(row.submitted_at||'')>String(before.submitted_at||''))latest.set(key,row);
    }
    const result=[];
    for(const [number,row] of [...latest].sort((a,b)=>a[0]-b[0])){
      let payload=row.payload_json||{};
      if(typeof payload==='string'){try{payload=JSON.parse(payload)}catch{continue}}
      for(const [field,label] of Object.entries(fields)){
        const raw=field.split('.').reduce((value,key)=>value?.[key],payload);
        if(typeof raw!=='string'||!raw.trim()||empty(raw.trim()))continue;
        if(field==='helpNow'&&!['즉시','이번 주'].includes(raw.trim()))continue;
        result.push({ref:`${row.id}|${field}`,student:`학생-${number}`,number,field,label,value:raw.trim(),peer:field.startsWith('peerObservations.'),sourceType:field==='peerObservations.hurt.detail'?payload.peerObservations?.hurt?.sourceType:'',frequency:field==='peerObservations.hurt.detail'?payload.peerObservations?.hurt?.frequency:'',ongoing:field==='peerObservations.hurt.detail'?payload.peerObservations?.hurt?.ongoing:null});
      }
    }
    return result;
  }
  function coverage(rows,month,analysis={}){
    const candidates=collect(rows,month);
    // A class-pattern mention is not an individual review. Only exact refs in the three cards cover an answer.
    const covered=new Set((analysis.priority_students||[]).slice(0,3).flatMap(item=>item.source_refs||[]));
    const additional=candidates.filter(item=>!covered.has(item.ref));
    const accounted=new Set([...candidates.filter(item=>covered.has(item.ref)).map(item=>item.ref),...additional.map(item=>item.ref)]);
    if(candidates.some(item=>!accounted.has(item.ref)))throw new Error('추가 확인 응답 누락');
    return {version:'2026.10.30-review-v1',checked:candidates.length,covered:candidates.length-additional.length,additional,missing:0};
  }
  const api={fields,collect,coverage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IeumSurveyReview=api;
})(globalThis);
