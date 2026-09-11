const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('student-comparison-report.js','utf8'),ctx);
const row=(number,month,payload={},extra={})=>({student_number:number,survey_month:month+'-01',submitted_at:month+'-02',payload_json:payload,...extra});
test('최근 응답 달을 이전 누적에서 제외하고 미참여는 0점으로 처리하지 않는다',()=>{
 const result=ctx.studentReportComparison({number:1},[row(1,'2026-06'),row(1,'2026-09'),row(2,'2026-06',{relationships:[{targetNumber:1,score:2}]}),row(2,'2026-07',{relationships:[{targetNumber:1,score:4}]}),row(2,'2026-09',{relationships:[{targetNumber:1,score:5}]})]);
 assert.equal(result.latestMonth,'2026-09');assert.equal(result.previous.length,1);assert.equal(result.relation.before.average,3);assert.equal(result.relation.before.months,2);assert.equal(result.relation.recent.average,5);
});
test('최신 월 제출만 사용하며 삭제·분석 제외·타 학생·미래 관찰을 제외한다',()=>{
 const result=ctx.studentReportComparison({number:1,studentId:'one'},[row(1,'2026-09',{helpNow:'과거 제출'},{submitted_at:'2026-09-01',student_id:'one'}),row(1,'2026-09',{helpNow:'최신 제출'},{submitted_at:'2026-09-03',student_id:'one'}),row(1,'2026-10',{}, {deleted_at:'x'}),row(1,'2026-11',{}, {analysis_excluded:true}),row(1,'2026-12',{}, {student_id:'other'})],[{studentId:'one',surveyMonth:'2026-10',observedFact:'이후 기록'},{studentId:'other',studentNumber:1,surveyMonth:'2026-09'}]);
 assert.equal(result.latestMonth,'2026-09');assert.equal(result.latest.helpNow,'최신 제출');assert.equal(result.previous.length,0);assert.equal(result.observations.recent.length,0);assert.equal(result.relation.before,null);
});
