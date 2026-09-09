(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IeumRelationshipData=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const payloadOf=row=>row?.payload_json||row?.payload||row||{};
  const monthOf=row=>String(row?.survey_month||payloadOf(row).surveyMonth||row?.submitted_at||'').slice(0,7);
  const positiveInteger=value=>((typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isInteger(Number(value))&&Number(value)>0)?Number(value):null;
  function normalizeRelationships(rows,rater,allowed){
    const result=new Map();
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      const target=positiveInteger(row?.targetNumber),value=row?.score;
      const score=(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''?Number(value):NaN;
      if(target&&target!==rater&&(!allowed||allowed.has(target))&&Number.isInteger(score)&&score>=1&&score<=5)result.set(target,{targetNumber:target,score});
    });
    return[...result.values()];
  }
  function latestRows(responses){
    const latest=new Map(),time=row=>Number.isFinite(Date.parse(row?.submitted_at))?Date.parse(row.submitted_at):0;
    (Array.isArray(responses)?responses:[]).filter(row=>row&&!row.analysis_excluded&&!row.deleted_at).slice().sort((a,b)=>time(b)-time(a)||String(b.id||'').localeCompare(String(a.id||''))).forEach(row=>{
      const number=positiveInteger(row.student_number||payloadOf(row).studentNumber),month=monthOf(row);
      if(!number||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
      const key=`${month}:${number}`;if(!latest.has(key))latest.set(key,row);
    });
    return latest;
  }
  function normalizeResponses(responses,students){
    const allowed=students?new Set(students.map(student=>positiveInteger(student.number)).filter(Boolean)):null;
    return[...latestRows(responses).values()].filter(row=>!allowed||allowed.has(Number(row.student_number||payloadOf(row).studentNumber))).map(row=>{
      const payload=payloadOf(row),number=Number(row.student_number||payload.studentNumber);
      return{...row,student_number:number,survey_month:`${monthOf(row)}-01`,payload_json:{...payload,relationships:normalizeRelationships(payload.relationships,number,allowed)}};
    });
  }
  function buildEvidence(responses,students){
    const directed=new Map();
    normalizeResponses(responses,students).forEach(row=>row.payload_json.relationships.forEach(item=>{
      const key=`${row.student_number}:${item.targetNumber}`;if(!directed.has(key))directed.set(key,new Map());directed.get(key).set(monthOf(row),item.score);
    }));
    const pairs=[],average=values=>values.size?[...values.values()].reduce((sum,value)=>sum+value,0)/values.size:null;
    students.forEach((student,index)=>students.slice(index+1).forEach(other=>{
      const a=Number(student.number),b=Number(other.number),ab=directed.get(`${a}:${b}`)||new Map(),ba=directed.get(`${b}:${a}`)||new Map(),months=[...new Set([...ab.keys(),...ba.keys()])].sort(),commonMonths=[...ab.keys()].filter(month=>ba.has(month)).sort();
      pairs.push({a,b,abCount:ab.size,baCount:ba.size,abAverage:average(ab),baAverage:average(ba),months,commonMonths,positiveMonths:commonMonths.filter(month=>ab.get(month)>=4&&ba.get(month)>=4)});
    }));
    const byStudent=new Map(students.map(student=>{
      const number=Number(student.number),related=pairs.filter(pair=>pair.a===number||pair.b===number),incoming=related.filter(pair=>(pair.a===number?pair.baCount:pair.abCount)>0),outgoing=related.filter(pair=>(pair.a===number?pair.abCount:pair.baCount)>0),both=related.filter(pair=>pair.commonMonths.length),possible=Math.max(0,students.length-1);
      return[number,{incomingPeers:incoming.length,outgoingPeers:outgoing.length,incomingResponses:incoming.reduce((sum,pair)=>sum+(pair.a===number?pair.baCount:pair.abCount),0),bothPeers:both.length,possible,coverage:possible?both.length/possible:0,months:[...new Set(related.flatMap(pair=>pair.months))].sort()}];
    }));
    return{pairs,byStudent};
  }
  function aiEvidence(responses,students){
    const quality=buildEvidence(responses,students),anonymous=number=>`학생-${number}`;
    return{students:[...quality.byStudent].map(([number,item])=>({student:anonymous(number),incoming_response_count:item.incomingResponses,incoming_peer_count:item.incomingPeers,possible_peer_count:item.possible,same_month_bidirectional_peer_count:item.bothPeers,observed_month_count:item.months.length,interpretation_deferred:item.possible===0||item.coverage<.8})),pairs:quality.pairs.filter(pair=>pair.months.length).map(pair=>({students:[anonymous(pair.a),anonymous(pair.b)],forward_response_count:pair.abCount,reverse_response_count:pair.baCount,observed_month_count:pair.months.length,same_month_bidirectional_count:pair.commonMonths.length,mutual_positive_month_count:pair.positiveMonths.length})),limits:'미응답은 0점이 아니며 80%는 검증된 신뢰도가 아닌 해석 보류 운영 기준입니다.'};
  }
  return{normalizeRelationships,latestRows,normalizeResponses,buildEvidence,aiEvidence};
});
