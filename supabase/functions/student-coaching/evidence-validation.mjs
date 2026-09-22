// Deterministic checks for explicit field, month, modality and score claims.
// This does not prove that an arbitrary paraphrase is semantically supported.
const fieldRules=[
 [/학습\s*자기평가|공부\s*자기평가|학습\s*점수/,'selfRatings.study'],
 [/경청\s*자기평가|경청\s*점수/,'selfRatings.listening'],
 [/관계\s*존중\s*자기평가|관계\s*존중\s*점수/,'selfRatings.respect'],
 [/예의\s*자기평가|예의\s*점수/,'selfRatings.manners'],
 [/책임감\s*자기평가|책임감\s*점수/,'selfRatings.responsibility'],
 [/학교생활\s*고민|고민\s*문항/,'studentState.worryDetail'],
 [/도움\s*요청/,'helpNow'],
 [/선생님께\s*듣고\s*싶은\s*말/,'studentState.teacherWish'],
 [/받은\s*관계\s*(?:점수|평가)|관계\s*(?:점수\s*)?평균/,'relationships']
];
const written=/(?:적었|적어\s*주|썼|써\s*주|쓴\s)/;
const scoreValues=source=>{
 if(source.field==='relationship_context')return [4]; // Explicit mutual-score threshold, never a student's average.
 if(source.field?.startsWith('selfRatings.'))return [Number(String(source.value).match(/^(\d+(?:\.\d+)?)점/)?.[1])];
 if(source.field==='relationships')return [Number(String(source.value).match(/평균\s+(\d+(?:\.\d+)?)/)?.[1])];
 return [];
};
export function validateEvidenceClaims(text,refs,sources){
 const cited=sources.filter(source=>refs.includes(source.id));
 for(const sentence of String(text).split(/(?<=[.!?。])\s+/u)){
   const mentions=[...sentence.matchAll(/(?<!\d)(?:(\d{4})년\s*)?(1[0-2]|[1-9])월/g)];
   const dated=mentions.length===1?cited.filter(source=>source.month?.endsWith('-'+mentions[0][2].padStart(2,'0'))&&(!mentions[0][1]||source.month.startsWith(mentions[0][1]+'-'))):cited;
   const scoreClaims=[...sentence.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*점/g)].map(match=>Number(match[1]));
   const asserted=/적었|썼|선택했|응답했|평가했|이라고\s*했|이라고\s*적/.test(sentence)||scoreClaims.length>0;
   const named=fieldRules.filter(([pattern])=>pattern.test(sentence)).map(([,field])=>field);
   if(asserted){
     for(const field of named)if(!dated.some(source=>source.field===field))throw new Error('코칭 문장의 문항과 연결된 근거가 일치하지 않습니다.');
     if(scoreClaims.length&&mentions.length>1)throw new Error('점수 비교는 월별로 문장을 나누어야 합니다.');
     if(scoreClaims.length&&named.length>1)throw new Error('점수 설명은 문항별로 문장을 나누어야 합니다.');
     const numeric=named.length?dated.filter(source=>source.field===named[0]):dated;
     for(const score of scoreClaims)if(!numeric.some(source=>scoreValues(source).includes(score)))throw new Error('코칭 문장의 점수가 해당 월·문항의 근거와 일치하지 않습니다.');
   }
   // Attribute the writing verb to its clause, not every reference on the card.
   // Short stored choices such as "이번 주" also occur in genuine narratives.
   for(const clause of sentence.split(/(?<=선택했고|선택했으며|선택하였고|선택하였으며|선택했지만)[,\s]+/u)){
     if(!written.test(clause))continue;
     const choices=dated.filter(source=>source.inputKind==='선택형');
     const fields=fieldRules.filter(([pattern])=>pattern.test(clause)).map(([,field])=>field);
     const explicitChoice=fields.includes('helpNow');
     const explicitNarrative=fields.length>0&&!explicitChoice&&fields.every(field=>dated.some(source=>source.field===field&&source.inputKind!=='선택형'));
     const choiceQuotation=choices.some(source=>[source.value,source.displayValue].some(value=>{
       if(!value)return false;
       const escaped=String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
       return new RegExp('[“‘"\u0027]?'+escaped+'[”’"\u0027]?(?:이?라고|라며|을|를)\\s*(?:적었|썼|써\\s*주|적어\\s*주)').test(clause);
     }));
     if(choices.length&&(explicitChoice||(!explicitNarrative&&choiceQuotation)))
       throw new Error('선택형 응답은 적었다가 아니라 선택했다고 표현해야 합니다. 문항별로 문장을 나누어 주세요.');
   }
 }
}

