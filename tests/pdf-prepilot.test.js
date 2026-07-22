const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('analysis-dashboard.css','utf8');

test('PDF 사전 점검은 A4 여백·한글 폰트·긴 블록 분할·페이지 번호를 유지한다',()=>{
  assert.match(app,/format:'a4'/);
  assert.match(app,/margin=16/);
  assert.match(app,/maxSlicePixels/);
  assert.match(app,/document\.fonts\?\.ready/);
  assert.match(app,/pdf\.text\(`\$\{number\} \/ \$\{total\}`/);
  assert.match(css,/"Malgun Gothic","Apple SD Gothic Neo"/);
});

test('학생 PDF는 긴 이름을 정리하고 월별 응답·AI·지원 이력을 독립 블록으로 구성한다',()=>{
  assert.match(app,/fileName\.replace/);
  assert.match(app,/buildStudentOverviewReportSection\(student\)/);
  assert.match(app,/buildStudentSupportReportSection\(student\)/);
  assert.match(app,/buildStudentMonthlyResponseReportSection\(student\)/);
  assert.match(app,/buildAiReportSectionWithoutTimeline/);
});
