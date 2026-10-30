// Factual display is reconstructed from current survey fields, never from an AI paraphrase.
export const GROUNDING_VERSION='2026.10.30-survey-grounding-v1';
export async function fingerprintRows(rows,month){
 const canonical=rows.filter(row=>String(row.survey_month).slice(0,7)===month).map(row=>({id:row.id,student:row.student_number,payload:row.payload_json})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical)));
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
const labels={helpNow:'도움 요청', 'studentState.worryDetail':'학교생활 고민','studentState.teacherWish':'선생님께 듣고 싶은 말','unresolved.detail':'아직 속상한 관계','peerObservations.hurt.detail':'상처 행동 관련 서술','peerObservations.needsHelp.detail':'도움이 필요한 친구 관련 서술','peerObservations.kind.detail':'친절한 친구 관련 서술','peerObservations.growth.detail':'변화한 친구 관련 서술'};
const choices={'괜찮음':'지금은 괜찮아요','이번 주':'이번 주에 이야기하고 싶어요','즉시':'바로 도와주세요'};
export const noConcern=value=>/^(없음|없다|없어요|없습니다|해당\s*없음|없|x|×|\-)[.!。\s]*$/i.test(String(value||'').trim());
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
 const priority=(analysis.priority_students||[]).map(item=>{
  const sources=resolve(item.source_refs);
  if(sources.some(source=>source.student!==item.student))throw new Error('분석 작성 학생과 근거 불일치');
  const usable=sources.filter(s=>s.field==='helpNow'?!/^(괜찮음|지금은 괜찮아요)[.!\s]*$/.test(s.value):!noConcern(s.value));
  if(!usable.length)throw new Error('어려움 판단을 뒷받침하는 응답 없음');
  // Peer growth/kind text describes the nominated peer, never the author's growth.
  const evidence=sources.map(s=>`[학생 원문] ${sentence(s)}`);
  return {...item,attention_reason:sources.map(sentence).join(' / '),protective_factors:[],possible_interpretations:[],evidence,source_refs:sources.map(s=>s.ref)};
 });
 const patterns=(analysis.class_patterns||[]).map(item=>{
  const sources=resolve(item.source_refs),students=new Set(sources.map(s=>s.student));
  return {...item,pattern:`${[...new Set(sources.map(s=>s.label))].join('·')} 관련 응답 ${students.size}명 · 원문 확인`,evidence:sources.map(s=>`[학생 원문] ${sentence(s)}`),source_refs:sources.map(s=>s.ref)};
 });
 return {...analysis,priority_students:priority,class_patterns:patterns,overall_judgment:`응답 근거가 연결된 학생 ${priority.length}명 · 교사 확인 필요`,_grounding_version:GROUNDING_VERSION};
}
