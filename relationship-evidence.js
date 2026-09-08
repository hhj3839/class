(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IeumRelationshipEvidence=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function build(responses,students,analysisCore){
    const numbers=new Set(students.map(student=>Number(student.number))),directed=new Map();
    // Missing replies remain unknown. Count each directed pair once per month.
    analysisCore.latestByStudentMonth(responses).forEach(item=>{
      const payload=item.payload_json||item.payload||item,rater=Number(item.student_number||payload.studentNumber),month=String(item.survey_month||payload.surveyMonth||item.submitted_at||'').slice(0,7);
      if(!numbers.has(rater)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
      const rows=new Map();
      (payload.relationships||[]).forEach(row=>{const target=Number(row.targetNumber),score=Number(row.score);if(numbers.has(target)&&target!==rater&&Number.isInteger(score)&&score>=1&&score<=5)rows.set(target,score)});
      rows.forEach((score,target)=>{const key=`${rater}:${target}`;if(!directed.has(key))directed.set(key,new Map());directed.get(key).set(month,score)});
    });
    const pairs=[];
    students.forEach((student,index)=>students.slice(index+1).forEach(other=>{
      const a=Number(student.number),b=Number(other.number),ab=directed.get(`${a}:${b}`)||new Map(),ba=directed.get(`${b}:${a}`)||new Map();
      const months=[...new Set([...ab.keys(),...ba.keys()])].sort(),commonMonths=[...ab.keys()].filter(month=>ba.has(month)).sort();
      const average=values=>values.size?[...values.values()].reduce((sum,value)=>sum+value,0)/values.size:null;
      pairs.push({a,b,abCount:ab.size,baCount:ba.size,abAverage:average(ab),baAverage:average(ba),months,commonMonths,positiveMonths:commonMonths.filter(month=>ab.get(month)>=4&&ba.get(month)>=4)});
    }));
    const byStudent=new Map(students.map(student=>{
      const number=Number(student.number),related=pairs.filter(pair=>pair.a===number||pair.b===number),incoming=related.filter(pair=>(pair.a===number?pair.baCount:pair.abCount)>0),outgoing=related.filter(pair=>(pair.a===number?pair.abCount:pair.baCount)>0),both=related.filter(pair=>pair.commonMonths.length),possible=Math.max(0,students.length-1);
      return[number,{incomingPeers:incoming.length,outgoingPeers:outgoing.length,incomingResponses:incoming.reduce((sum,pair)=>sum+(pair.a===number?pair.baCount:pair.abCount),0),bothPeers:both.length,possible,coverage:possible?both.length/possible:0,months:[...new Set(related.flatMap(pair=>pair.months))].sort()}];
    }));
    return{pairs,byStudent};
  }
  function groups(analysis){return analysis.groups.map(group=>{
    const possible=group.length*(group.length-1)/2,links=analysis.mutual.filter(edge=>edge.strength>=4.5&&group.includes(edge.a)&&group.includes(edge.b)).length;
    return{members:group,links,possible,density:possible?links/possible:0};
  })}
  function description(summary,connections){
    if(!summary||!summary.possible)return'비교할 관계 자료가 없습니다.';
    // Operational display guard only; this is not a validated reliability cutoff.
    if(summary.coverage<.8)return'양방향 관측 자료가 적어 연결 수 해석을 보류합니다.';
    return connections<=1?'표시 기준에 해당하는 연결이 적게 관찰됩니다. 고립을 뜻하지 않습니다.':'표시된 연결은 관계 점수 기준이며 실제 친밀도를 확정하지 않습니다.';
  }
  return{build,groups,description};
});
