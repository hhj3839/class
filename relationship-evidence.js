(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IeumRelationshipEvidence=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function build(responses,students,analysisCore){
    const data=typeof module==='object'&&module.exports?require('./supabase/functions/analyze-class/relationship-data.js'):globalThis.IeumRelationshipData;
    return data.buildEvidence(responses,students);
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
  function pairDescription(pair){
    if(!pair.abCount||!pair.baCount)return '한쪽 또는 양쪽 응답이 없어 상호 해석 보류';
    if(!pair.commonMonths.length)return '서로 다른 시기의 응답 · 같은 달 상호 관측 없음';
    return `함께 응답한 ${pair.commonMonths.length}개월 중 서로 4점 이상 ${pair.positiveMonths.length}개월`;
  }
  return{build,groups,description,pairDescription};
});
