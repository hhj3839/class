const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('학생 보고서는 폐기된 관찰 비교 보고서를 다시 연결하지 않는다',()=>{
 const code=fs.readFileSync('student-comparison-report.js','utf8');
 assert.match(code,/function buildStudentOverviewPdfReport/);
 assert.doesNotMatch(code,/getObservations|studentReportComparison|buildStudentComparisonReport/);
 assert.match(fs.readFileSync('student-report-pdf.css','utf8'),/font-size:16px/);
});
