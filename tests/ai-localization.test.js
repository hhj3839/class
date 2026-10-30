const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('supabase/functions/analyze-class/index.ts','utf8');
// Exercise the exact production translation rules, not a simplified substitute.
const labels=vm.runInNewContext(source.match(/const internalLabelMap:\[RegExp,string\]\[\]=([\s\S]*?);\r?\nconst localizeAnalysisValues/)[1]);
test('presentation translation preserves every supported source path and metadata',async()=>{
 const {localizeAnalysis}=await import('../supabase/functions/analyze-class/localization.mjs');
 const fields=['helpNow','studentState.worryDetail','studentState.teacherWish','unresolved.detail',...['kind','growth','hurt','needsHelp'].map(key=>`peerObservations.${key}.detail`)];
 const refs=fields.map(field=>`response-3|${field}`);
 const input={priority_students:[{student:'학생-3',source_refs:refs,evidence:['helpNow teacherWish hurt']}],class_patterns:[{source_refs:refs}],_analysis_version:'study-version',_source_fingerprint:'peer-hash'};
 const before=JSON.stringify(input),result=localizeAnalysis(input,labels);
 assert.deepEqual(result.priority_students[0].source_refs,refs);
 assert.deepEqual(result.class_patterns[0].source_refs,refs);
 assert.equal(result._analysis_version,'study-version');assert.equal(result._source_fingerprint,'peer-hash');
 assert.equal(result.priority_students[0].evidence[0],'도움 요청 선생님께 듣고 싶은 말 상처 행동 문항');
 assert.equal(JSON.stringify(input),before);
});
test('new result and cached round-trip both retain valid grounding references',async()=>{
 const {localizeAnalysis}=await import('../supabase/functions/analyze-class/localization.mjs');
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=[{id:'r3',student_number:3,survey_month:'2026-09-01',payload_json:{helpNow:'이번 주',studentState:{teacherWish:'응원'},peerObservations:{hurt:{detail:'가상 응답'}}}}];
 const refs=['r3|helpNow','r3|studentState.teacherWish','r3|peerObservations.hurt.detail'];
 const input={priority_students:[{student:'학생-3',source_refs:refs}],class_patterns:[{source_refs:refs}]};
 const fresh=groundClassAnalysis(localizeAnalysis(input,labels),rows,'2026-09');
 const cached=groundClassAnalysis(localizeAnalysis(JSON.parse(JSON.stringify(fresh)),labels),rows,'2026-09');
 assert.deepEqual(cached,fresh);
 assert.match(cached.priority_students[0].attention_reason,/이번 주에 이야기하고 싶어요/);
});
test('invalid references still fail closed after localization',async()=>{
 const {localizeAnalysis}=await import('../supabase/functions/analyze-class/localization.mjs');
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 for(const refs of [[],['missing|helpNow'],['r3|도움 요청']])assert.throws(()=>groundClassAnalysis(localizeAnalysis({priority_students:[{student:'학생-3',source_refs:refs}]},labels),[],'2026-09'),/근거 연결 검증 실패/);
 assert.match(source,/return localizeAnalysis\(value,internalLabelMap\)/);
});
