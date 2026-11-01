// Request-local E numbers are never persisted without a stable evidence manifest.
// Historical cards have no manifest: only a known builder and identical source hash
// can prove the positional mapping. Never infer a mapping from a plausible sentence.
const legacyBuilders=new Set(['2026.09.22-relationship-questions-v11','2026.10.30-grounded-dialogue-v12']);
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function stableEvidence(sources,studentId){
  const result=await Promise.all(sources.map(async source=>({...source,legacyId:source.id,id:'S'+await hash([studentId,source.kind,source.responseId||null,source.month,source.field])})));
  if(new Set(result.map(s=>s.id)).size!==result.length)throw new Error('근거 식별자가 중복되었습니다.');
  return result;
}
const manifest=async sources=>Promise.all(sources.map(async s=>({id:s.id,hash:await hash([s.month,s.field,s.value,s.displayValue,s.safetyContext||null,[...(s.responseIds||[])].sort()])})));
function remap(card,mapping){
  const copy=JSON.parse(JSON.stringify(card));
  for(const item of [copy.summary,...(copy.strengths||[]),...(copy.needs||[]),copy.question,...(copy.actions||[])]){
    if(!Array.isArray(item?.refs))throw new Error('저장 근거 형식이 올바르지 않습니다.');
    item.refs=item.refs.map(ref=>{if(!mapping.has(ref))throw new Error('저장 근거 연결을 복원할 수 없습니다.');return mapping.get(ref)});
  }
  return copy;
}
export async function persistEvidence(card,sources){
  return {...remap(card,new Map(sources.map(s=>[s.legacyId,s.id]))),evidenceManifest:await manifest(sources),evidenceFormat:1};
}
export async function restoreEvidence(existing,sourceHash,sources,validate){
  if(!existing)return null;
  const original=existing.result_json;
  if(typeof original?.version!=='string')throw new Error('저장 버전 확인 필요');
  let candidate;
  if(original.evidenceFormat===1){
    const current=await manifest(sources),old=original.evidenceManifest;
    // Compare the entire selected-student evidence set, including uncited safety sources.
    if(!Array.isArray(old)||old.length!==current.length||current.some(s=>!old.some(o=>o.id===s.id&&o.hash===s.hash)))throw new Error('학생 근거 자료 변경');
    candidate=original;
  }else{
    if(existing.source_hash!==sourceHash||(!legacyBuilders.has(original.version)&&original.validationVersion!=='2026.10.30-evidence-grounding-v2'))throw new Error('과거 근거 연결 확인 불가');
    candidate=remap(original,new Map(sources.map(s=>[s.legacyId,s.id])));
  }
  // No writes, no model request, no replacement of the original generation version.
  return {...validate(candidate,sources),version:original.version,evidenceFormat:1,evidenceManifest:await manifest(sources)};
}
