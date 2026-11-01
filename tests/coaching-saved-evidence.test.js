const test=require('node:test'),assert=require('node:assert/strict');
const api=()=>import('../supabase/functions/student-coaching/saved-evidence.mjs');
const sources=()=>[{id:'E1',kind:'response',responseId:'response-a',month:'2026-09',field:'studentState.worryDetail',value:'공부'}];
const card=()=>({version:'2026.09.22-relationship-questions-v11',summary:{text:'학교생활 고민에 공부를 적었습니다.',refs:['E1']},strengths:[],needs:[],question:{text:'요즘은 어떠니?',refs:['E1']},actions:[{title:'이야기하면',steps:['학생의 말을 확인합니다.'],refs:['E1']}],check_after:'원할 때 다시 이야기합니다.',limitations:['응답 기준입니다.']});
test('고정 ID는 순번과 원문이 바뀌어도 응답·문항·학생에 귀속된다',async()=>{
 const {stableEvidence}=await api(),a=await stableEvidence(sources(),'student');
 assert.equal(a[0].id,(await stableEvidence([{...sources()[0],id:'E20',value:'다른 내용'}],'student'))[0].id);
 assert.notEqual(a[0].id,(await stableEvidence(sources(),'other-student'))[0].id);
 assert.notEqual(a[0].id,(await stableEvidence([{...sources()[0],field:'helpNow'}],'student'))[0].id);
 await assert.rejects(stableEvidence([...sources(),...sources()],'student'),/중복/);
});
test('새 카드의 고정 근거와 전체 근거 지문은 순서와 무관하게 재검증한다',async()=>{
 const {stableEvidence,persistEvidence,restoreEvidence}=await api(),s=await stableEvidence(sources(),'student'),saved=await persistEvidence(card(),s);
 assert.equal(saved.summary.refs[0],s[0].id);
 let calls=0;const validate=c=>{calls++;return c};
 const restored=await restoreEvidence({result_json:saved,source_hash:'old-class-hash'},'new-class-hash',s,validate);
 assert.equal(restored.version,card().version);assert.equal(calls,1);
 await assert.rejects(restoreEvidence({result_json:saved},'',await stableEvidence([{...sources()[0],value:'변경'}],'student'),validate),/변경/);
 await assert.rejects(restoreEvidence({result_json:saved},'',[...s,{...s[0],id:'new-safety'}],validate),/변경/);
 await assert.rejects(restoreEvidence({result_json:saved},'',[],validate),/변경/);
});
test('과거 순번은 동일 자료·알려진 구성에서만 복원하며 검증 실패를 숨기지 않는다',async()=>{
 const {stableEvidence,restoreEvidence}=await api(),s=await stableEvidence(sources(),'student'),existing={source_hash:'same',result_json:card()};
 assert.equal((await restoreEvidence(existing,'same',s,c=>c)).summary.refs[0],s[0].id);
 await assert.rejects(restoreEvidence(existing,'changed',s,c=>c),/확인 불가/);
 await assert.rejects(restoreEvidence({...existing,result_json:{...card(),version:'unknown'}},'same',s,c=>c),/확인 불가/);
 await assert.rejects(restoreEvidence(existing,'same',s,()=>{throw Error('원문 불일치')}),/원문 불일치/);
 assert.deepEqual(existing.result_json.summary.refs,['E1']);
});
test('다른 학생에 대한 명시적 진술은 허용하고 작성자 강점 전환은 차단한다',async()=>{
 const {validateCard}=await import('../supabase/functions/student-coaching/coaching.mjs');
 const s=[{id:'E1',month:'2026-09',field:'peerObservations.hurt.detail',value:'친구가 맞는 장면을 봤다'}],c=card();
 c.summary.text='9월에 다른 학생이 맞는 장면을 목격했다고 적었습니다.';
 assert.doesNotThrow(()=>validateCard(c,s));
 c.strengths=[{text:'이 학생은 친구를 잘 도왔다고 적었습니다.',refs:['E1']}];
 assert.throws(()=>validateCard(c,s),/강점/);
});
