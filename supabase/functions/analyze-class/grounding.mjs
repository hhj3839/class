// Factual display is reconstructed from current survey fields, never from an AI paraphrase.
import '../../../survey-review.js';
import {parentSupportCandidate,parentSupportPattern} from './parent-support.mjs';
export const GROUNDING_VERSION='2026.10.30-survey-grounding-v2';
export async function fingerprintRows(rows,month){
 const canonical=rows.filter(row=>String(row.survey_month).slice(0,7)===month).map(row=>({id:row.id,student:row.student_number,payload:row.payload_json})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical)));
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
const labels={helpNow:'도움 요청', 'studentState.worryDetail':'학교생활 고민','studentState.teacherWish':'선생님께 듣고 싶은 말','studentState.parentWish':'부모님께 바라는 점','unresolved.detail':'아직 속상한 관계','peerObservations.hurt.detail':'상처 행동 관련 서술','peerObservations.needsHelp.detail':'도움이 필요한 친구 관련 서술','peerObservations.kind.detail':'친절한 친구 관련 서술','peerObservations.growth.detail':'변화한 친구 관련 서술'};
const choices={'괜찮음':'지금은 괜찮아요','이번 주':'이번 주에 이야기하고 싶어요','즉시':'바로 도와주세요'};
export const noConcern=value=>/^(없음|없다|없어요|없습니다|해당\s*없음|없|x|×|\-)[.!。\s]*$/i.test(String(value||'').trim());
const supportFields=new Set(['studentState.parentWish','helpNow','studentState.worryDetail','unresolved.detail','peerObservations.hurt.detail','peerObservations.needsHelp.detail']);
const relationshipFields=new Set(['unresolved.detail','peerObservations.hurt.detail','peerObservations.needsHelp.detail']);
const hasContent=source=>source.field==='helpNow'
 ? ['이번 주','즉시'].includes(source.value)
 : !noConcern(source.value)&&! /^(모르겠어요|모르겠습니다|모름|몰라요|몰라|잘\s*모르겠어요|\?+)[.!。?\s]*$/.test(source.value);
// These are requests to check the cited survey, not inferred events or diagnoses.
function guidance(sources){
 if(sources.some(s=>relationshipFields.has(s.field)))return {
  context:'비공개 대화',behavior:'관계 응답의 상황과 현재 필요한 도움을 확인합니다.',
  question:'적어 준 관계 이야기에서 선생님이 알아주면 좋을 점이 있니?'};
 if(sources.some(s=>s.field==='studentState.worryDetail'))return {
  context:'비공개 대화',behavior:'작성한 고민의 의미와 원하는 도움을 확인합니다.',
  question:'적어 준 고민에 관해 더 이야기하고 싶은 점이 있니?'};
 if(sources.some(s=>s.field==='helpNow'))return {
  context:'비공개 대화',behavior:'선택한 도움 요청과 지금 필요한 지원을 확인합니다.',
  question:'선생님과 어떤 이야기를 나누고 싶니?'};
 return {context:'비공개 대화',behavior:'연결된 문항의 응답 의미를 학생에게 확인합니다.',
  question:'적어 준 이야기에 대해 더 들려주고 싶은 점이 있니?'};
}
export function sourceIndex(rows,month){
 const map=new Map();
 for(const row of rows.filter(r=>String(r.survey_month).slice(0,7)===month&&!r.analysis_excluded&&!r.deleted_at)){
  for(const [field,label] of Object.entries(labels)){
   const value=field.split('.').reduce((v,key)=>v?.[key],row.payload_json);
   if(typeof value!=='string'||!value.trim())continue;
   const ref=`${row.id}|${field}`;
   map.set(ref,{ref,student:`학생-${row.student_number}`,field,label,value:value.trim(),peer:field.startsWith('peerObservations.')});
  }
 }
 return map;
}
function sentence(source){
 const value=source.field==='helpNow'?(choices[source.value]||source.value):source.value;
 return `${source.student}의 ${source.label}${source.peer?' (다른 친구에 관한 응답; 대상 확인 필요)':''}: “${value}”${source.field==='helpNow'?' 선택':''}`;
}
export function groundClassAnalysis(analysis,rows,month){
 const index=sourceIndex(rows,month);
 const resolve=refs=>{
  if(!Array.isArray(refs)||!refs.length||refs.some(ref=>!index.has(ref)))throw new Error('분석 근거 연결 검증 실패');
  return [...new Set(refs)].map(ref=>index.get(ref));
 };
 const priority=(analysis.priority_students||[]).slice(0,3).map(item=>{
  const sources=resolve(item.source_refs);
  if(sources.some(source=>source.student!==item.student))throw new Error('분석 작성 학생과 근거 불일치');
  const usable=sources.filter(s=>supportFields.has(s.field)&&hasContent(s)&&(s.field!=='studentState.parentWish'||parentSupportCandidate(s.value)));
  if(!usable.length)throw new Error('어려움 판단을 뒷받침하는 응답 없음');
  // Prioritize reviewing safety-related answers, never label their author as a victim or aggressor.
  const immediate=usable.some(s=>s.field==='helpNow'&&s.value==='즉시'||relationshipFields.has(s.field));
  const advice=guidance(usable),evidence=usable.map(s=>`[학생 원문] ${sentence(s)}`);
  return {...item,priority:immediate?'즉시 확인':'지속 관찰',attention_reason:usable.map(sentence).join(' / '),
   protective_factors:[],possible_interpretations:[],avoid_actions:[],
   observation_points:[{context:advice.context,behavior:advice.behavior}],
   coaching_questions:[advice.question],coaching_directions:[advice.behavior],
   evidence,source_refs:usable.map(s=>s.ref)};
 });
 const patterns=(analysis.class_patterns||[]).filter(item=>!item._parent_support).map(item=>{
  const sources=resolve(item.source_refs).filter(hasContent),students=new Set(sources.map(s=>s.student));
  if(!sources.length)throw new Error('학급 흐름을 뒷받침하는 응답 없음');
  const advice=guidance(sources);
  return {...item,pattern:`${[...new Set(sources.map(s=>s.label))].join('·')} 관련 응답 ${students.size}명 · 원문 확인`,
   teacher_check:advice.behavior,evidence:sources.map(s=>`[학생 원문] ${sentence(s)}`),source_refs:sources.map(s=>s.ref)};
 });
 const review=globalThis.IeumSurveyReview.coverage(rows,month,{priority_students:priority});
 // Rebuild from current, latest valid originals on every generation AND cached lookup.
 // Reserve one visible class-support slot without replacing any of the three student cards.
 const parentSources=globalThis.IeumSurveyReview.collect(rows,month);
 const parentPattern=parentSupportPattern(parentSources);
 if(parentPattern){patterns.unshift(parentPattern);patterns.splice(3)}
 const parentRefs=parentSources.filter(s=>s.field==='studentState.parentWish'&&parentSupportCandidate(s.value)).map(s=>s.ref);
 if(parentRefs.some(ref=>!patterns.some(item=>item.source_refs.includes(ref))))throw new Error('부모님께 바라는 점 지원 근거 누락');
 return {...analysis,priority_students:priority,class_patterns:patterns,additional_review:review,
  limitations:['즉시 확인은 도움 요청 선택 또는 관계 안전 관련 문항의 원문 확인 우선순위이며, 실제 위험이나 학생의 역할을 확정하지 않습니다.','연결된 응답의 작성 학생 수이며, 학급 전체의 같은 문제 경험 인원이나 진단이 아닙니다.'],
  overall_judgment:`응답 근거가 연결된 학생 ${priority.length}명 · 교사 확인 필요`,_grounding_version:GROUNDING_VERSION};
}
