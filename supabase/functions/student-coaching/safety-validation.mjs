// Explicit structured requests only; this is not a diagnosis or a text classifier.
export function urgentEvidence(sources){
 return sources.filter(source=>source.field==='helpNow'&&/^(?:즉시|바로\s*도와주세요)[.!。\s]*$/.test(String(source.value).trim()));
}
export function validateSafetyPriority(card,sources){
 const urgent=urgentEvidence(sources);if(!urgent.length)return;
 const linked=refs=>urgent.some(source=>refs?.includes(source.id));
 const immediate=text=>/지금|즉시|바로/.test(text)&&/비공개/.test(text)&&/안전/.test(text);
 const first=card.actions?.[0],steps=first?.steps?.join(' ')||'';
 if(!linked(card.summary?.refs)||!immediate(card.summary?.text||'')||
    first?.title!=='교사가 지금 안전을 확인하기'||!linked(first?.refs)||!immediate(steps)||!/보호/.test(steps)||
    !/^지금 안전 확인:/.test(card.check_after||'')||!/[\r\n]+보호 후 다시 확인:/.test(card.check_after||''))
   throw new Error('긴급 도움 요청의 안전 우선 안내를 검증하지 못했습니다.');
}
