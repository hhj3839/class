const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('학생 PDF는 한눈에 보기와 코칭을 출력하며 관찰 데이터를 읽지 않는다',()=>{
 const ctx=vm.createContext({escapeHTML:value=>String(value).replaceAll('<','&lt;'),classSettings:{schoolYear:2026},studentMonthlyResponses:()=>[{month:'2026-09',item:{}}],incomingRelationshipFor:()=>({average:4,count:3}),receivedPositiveMentions:()=>[1,2],payloadOf:()=>({studentState:{worryDetail:'고민 원문'},helpNow:'도움 원문'}),getObservations:()=>{throw Error('관찰 조회 금지')}});
 vm.runInContext(fs.readFileSync('student-comparison-report.js','utf8'),ctx);
 const html=ctx.buildStudentOverviewPdfReport({number:1,name:'가상'},{includeNames:true,includeOriginals:true},'<h2>학생 코칭</h2>');
 for(const value of ['학생 한눈에 보기','학생 코칭','4.0점','2건','고민 원문'])assert.ok(html.includes(value));assert.ok(!html.includes('교사 관찰'));
 const anonymous=ctx.buildStudentOverviewPdfReport({number:1,name:'가상'},{includeNames:false,includeOriginals:true});assert.ok(!anonymous.includes('고민 원문'));assert.ok(!anonymous.includes('가상'));
});
