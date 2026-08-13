const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../relationship-core.js');
const fakeCore={cumulativeScores:()=>({months:['2026-06'],participants:new Set([1,2,3]),relationResponders:new Set([1,2,3]),samples:new Map(),scores:new Map([['1:2',5],['2:1',5],['2:3',4],['3:2',4]])}),isRelationshipReady:()=>true};
test('관계 계산 모듈은 화면과 독립적으로 상호 연결과 집단을 계산한다',()=>{const result=core.build([], [{number:1,name:'A'},{number:2,name:'B'},{number:3,name:'C'}],fakeCore);assert.equal(result.ready,true);assert.equal(result.mutual.length,2);assert.deepEqual(result.groups,[[1,2]])});
test('관계 계산은 입력 학생 명단을 변경하지 않는다',()=>{const students=[{number:1,name:'A'},{number:2,name:'B'},{number:3,name:'C'}],before=JSON.stringify(students);core.build([],students,fakeCore);assert.equal(JSON.stringify(students),before)});
