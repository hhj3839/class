// Conservative review candidates, not diagnoses or verified family circumstances.
export function parentSupportCandidate(value){
 const text=String(value||'').replace(/\s+/g,'').trim();
 if(!text||/^(없음|없다|없어요|없습니다|딱히없음|모름|모르겠습니다)[.!。]*$/.test(text))return false;
 if(/^(도움(?:이)?필요없(?:어요|습니다|다)?|도와주지않아도(?:돼요|됩니다))[.!。]*$/.test(text))return false;
 return /도와(?:줘|주)|도움.*(?:필요|주세요|부탁)|(?:공부|숙제|문제).*(?:알려|도와|어려)|화(?:를)?.*(?:적게|줄|그만|내지)|(?:때리|때리지|무서|힘들|괴롭|걱정|비교하지|비교를그만)|(?:학원|공부|숙제).*(?:그만|줄여|줄이|쉬|끊|끝어|힘들|어려)|(?:이야기|말|마음).*(?:들어|알아)|(?:시간|함께|같이).*(?:보내|놀아|있어줘)/.test(text);
}

export function parentSupportDirections(sources){
 const rules=[
  {title:'학습 도움 요청',matches:/공부|숙제|문제/,request:/알려|도와|도움/,check:'어느 공부에서 어떤 설명이나 도움이 필요한지 개별 확인합니다.',support:'학급에서는 막힌 부분을 질문하는 방법을 연습하고, 원하는 학생에게 짧은 설명 시간을 제공합니다.'},
  {title:'학원 관련 요청',matches:/학원/,request:/그만|줄여|줄이|쉬|끊|끝어|힘들|어려/,check:'학원에 대해 바꾸고 싶은 점과 이유를 비공개로 묻습니다. 부담이나 중단 필요성을 단정하지 않습니다.',support:'학급에서는 원하는 도움을 말로 표현하는 방법을 연습합니다. 학원 변경이나 보호자 전달은 자동으로 결정하지 않습니다.'},
  {title:'화 표현 관련 요청',matches:/화/,request:/적게|줄|그만|내지/,check:'어떤 말이나 상황을 가리키는지, 지금 안전한지와 원하는 도움을 비공개로 확인합니다. 가정 상황을 단정하지 않습니다.',support:'학급에서는 불편한 상황에서 믿을 만한 어른에게 도움을 요청하는 방법을 안내합니다. 개인 응답은 공개하지 않습니다.'}
 ];
 return rules.flatMap(rule=>{const matched=sources.filter(s=>{const text=s.value.replace(/\s+/g,'');return parentSupportCandidate(text)&&rule.matches.test(text)&&rule.request.test(text)});return matched.length?[{title:rule.title,check:rule.check,support:rule.support,source_refs:matched.map(s=>s.ref)}]:[]});
}

export function parentSupportPattern(sources){
 const selected=sources.filter(s=>s.field==='studentState.parentWish'&&parentSupportCandidate(s.value));
 if(!selected.length)return null;
 return {_parent_support:true,
  pattern:`부모님께 바라는 점 · 지원 요청 후보 ${new Set(selected.map(s=>s.student)).size}명 · 원문 기반 보완`,
  evidence:selected.map(s=>`[학생 원문] ${s.student}의 부모님께 바라는 점: “${s.value}”`),
  source_refs:selected.map(s=>s.ref),
  support_directions:parentSupportDirections(selected),
  teacher_check:'학생에게 원하는 도움을 개별 확인하고, 학급에서는 도움 요청 방법을 함께 연습합니다.'};
}
