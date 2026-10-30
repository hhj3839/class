// Conservative review candidates, not diagnoses or verified family circumstances.
export function parentSupportCandidate(value){
 const text=String(value||'').replace(/\s+/g,'').trim();
 if(!text||/^(없음|없다|없어요|없습니다|딱히없음|모름|모르겠습니다)[.!。]*$/.test(text))return false;
 if(/^(도움(?:이)?필요없(?:어요|습니다|다)?|도와주지않아도(?:돼요|됩니다))[.!。]*$/.test(text))return false;
 return /도와(?:줘|주)|도움.*(?:필요|주세요|부탁)|(?:공부|숙제|문제).*(?:알려|도와|어려)|화(?:를)?.*(?:적게|줄|그만|내지)|(?:때리|때리지|무서|힘들|괴롭|걱정|비교하지|비교를그만)|(?:학원|공부|숙제).*(?:그만|줄여|줄이|쉬|끊|끝어|힘들|어려)|(?:이야기|말|마음).*(?:들어|알아)|(?:시간|함께|같이).*(?:보내|놀아|있어줘)/.test(text);
}

export function parentSupportPattern(sources){
 const selected=sources.filter(s=>s.field==='studentState.parentWish'&&parentSupportCandidate(s.value));
 if(!selected.length)return null;
 return {_parent_support:true,
  pattern:`부모님께 바라는 점 · 지원 요청 후보 ${new Set(selected.map(s=>s.student)).size}명 · 원문 기반 보완`,
  evidence:selected.map(s=>`[학생 원문] ${s.student}의 부모님께 바라는 점: “${s.value}”`),
  source_refs:selected.map(s=>s.ref),
  teacher_check:'학생에게 원하는 도움을 개별 확인하고, 학급에서는 도움 요청 방법을 함께 연습합니다.'};
}
