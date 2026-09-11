const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('student-comparison-report.js','utf8'),ctx);
const row=(number,month,payload={},extra={})=>({student_number:number,survey_month:month+'-01',submitted_at:month+'-02',payload_json:payload,...extra});
test('보고서는 항목별 두 열과 아래 변화 요약을 사용하고 PDF 본문은 16px로 표시한다',()=>{
 ctx.allResponses=[row(1,'2026-09',{studentState:{worryDetail:'<script>기록'}})];ctx.getObservations=()=>[];ctx.escapeHTML=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const html=ctx.buildStudentComparisonReport({number:1,name:'가상학생'},{includeNames:true,includeOriginals:true});
 assert.equal((html.match(/class="pdf-block pdf-comparison-card"/g)||[]).length,4);
 assert.equal((html.match(/<thead><tr><th>이전 기록<\/th><th>/g)||[]).length,4);
 assert.equal((html.match(/class="pdf-comparison-change"/g)||[]).length,4);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('font-size:13px'));
 assert.match(fs.readFileSync('student-report-pdf.css','utf8'),/font-size:16px/);
 assert.match(fs.readFileSync('app.js','utf8'),/hasAttribute\('data-pdf-page-start'\)&&y>margin/);
});
test('최근 응답 달을 이전 누적에서 제외하고 미참여는 0점으로 처리하지 않는다',()=>{
 const result=ctx.studentReportComparison({number:1},[row(1,'2026-06'),row(1,'2026-09'),row(2,'2026-06',{relationships:[{targetNumber:1,score:2}]}),row(2,'2026-07',{relationships:[{targetNumber:1,score:4}]}),row(2,'2026-09',{relationships:[{targetNumber:1,score:5}]})]);
 assert.equal(result.latestMonth,'2026-09');assert.equal(result.previous.length,1);assert.equal(result.relation.before.average,3);assert.equal(result.relation.before.months,2);assert.equal(result.relation.recent.average,5);
});
test('최신 월 제출만 사용하며 삭제·분석 제외·타 학생·미래 관찰을 제외한다',()=>{
 const result=ctx.studentReportComparison({number:1,studentId:'one'},[row(1,'2026-09',{helpNow:'과거 제출'},{submitted_at:'2026-09-01',student_id:'one'}),row(1,'2026-09',{helpNow:'최신 제출'},{submitted_at:'2026-09-03',student_id:'one'}),row(1,'2026-10',{}, {deleted_at:'x'}),row(1,'2026-11',{}, {analysis_excluded:true}),row(1,'2026-12',{}, {student_id:'other'})],[{studentId:'one',surveyMonth:'2026-10',observedFact:'이후 기록'},{studentId:'other',studentNumber:1,surveyMonth:'2026-09'}]);
 assert.equal(result.latestMonth,'2026-09');assert.equal(result.latest.helpNow,'최신 제출');assert.equal(result.previous.length,0);assert.equal(result.observations.recent.length,0);assert.equal(result.relation.before,null);
});
