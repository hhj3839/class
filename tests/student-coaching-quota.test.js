const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const source=fs.readFileSync('student-coaching.js','utf8').split('// Only highlight')[0];
 const context={};vm.runInNewContext(source+';globalThis.api={acceptCoachingData,studentCoachingState,studentCoachingQuota};',context);return context.api;
}
test('학생을 다시 선택해도 학급 공통 잔여량을 사용한다',()=>{
 const api=setup(),a=api.acceptCoachingData('class:a',{remaining:96,quotaCheckedAt:1,quotaMonth:'2026-09'});
 api.studentCoachingState.set('class:a',{data:a});
 api.acceptCoachingData('class:b',{remaining:91,quotaCheckedAt:2,quotaMonth:'2026-09'});
 assert.equal(api.studentCoachingState.get('class:a').data.remaining,91);
 assert.equal(api.acceptCoachingData('class:c',{remaining:95,quotaCheckedAt:1,quotaMonth:'2026-09'}).remaining,91);
});
test('월 초기화 및 다른 학급 잔여량을 분리한다',()=>{
 const api=setup();api.acceptCoachingData('class:a',{remaining:91,quotaCheckedAt:1,quotaMonth:'2026-09'});
 assert.equal(api.acceptCoachingData('other:a',{remaining:100,quotaCheckedAt:2,quotaMonth:'2026-09'}).remaining,100);
 assert.equal(api.acceptCoachingData('class:b',{remaining:100,quotaCheckedAt:3,quotaMonth:'2026-10'}).remaining,100);
 assert.equal(api.studentCoachingQuota.get('class').month,'2026-10');
});
test('로그아웃 시 공통 잔여량을 삭제하고 학생 변경은 무료 조회한다',()=>{
 const source=fs.readFileSync('student-coaching.js','utf8');
 assert.match(source,/studentCoachingState.clear\(\);studentCoachingQuota.clear\(\)/);
 assert.doesNotMatch(source,/if\(state.data&&!forceReload\)/);
 assert.match(source,/if\(generate\)\{try\{const refreshed=await teacherEdgeFunction/);
});
