const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),ctx=vm.createContext({escapeHTML:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),monthLabel:m=>m});
vm.runInContext(app.slice(app.indexOf('function studentVoiceBriefHTML('),app.indexOf('function renderStudentDetail(')),ctx);
test('학생 목소리는 세 응답 원문을 인용하고 HTML을 실행하지 않는다',()=>{
 const html=ctx.studentVoiceBriefHTML({studentState:{worryDetail:'공부가 어려워요',teacherWish:'잘해엇',parentWish:'<img src=x>'}},'2026-09');
 for(const value of ['2026-09','공부가 어려워요','잘해엇','&lt;img','부모님께 바라는 점'])assert.ok(html.includes(value));assert.ok(!html.includes('<img'));
});
test('정확한 없음 표현만 숨기고 혼합 문장과 모호한 답은 보존한다',()=>{
 for(const value of ['', '없음.', '없어요!', '딱히 없습니다'])assert.match(ctx.studentVoiceBriefHTML({studentState:{worryDetail:value}},'2026-09'),/별도로 적은 고민이나 바람이 없습니다/);
 for(const value of ['모르겠어요','딱히 없지만 공부가 걱정돼요'])assert.ok(ctx.studentVoiceBriefHTML({studentState:{worryDetail:value}},'2026-09').includes(value));
});
test('한눈에 보기에는 관계 해석 대신 목소리를 표시하고 변화는 변화 탭에 둔다',()=>{
 const summary=app.slice(app.indexOf('  content.innerHTML=`<div id="studentPanelSummary"'),app.indexOf('  renderStudentCoachingShell(student);setStudentDetailTab',app.indexOf('  content.innerHTML=`<div id="studentPanelSummary"')));
 assert.match(summary,/studentVoiceBriefHTML\(latest,latestMonth\)/);assert.doesNotMatch(summary,/relationshipBriefHTML/);
 assert.ok(summary.indexOf('${studentInsight}')>summary.indexOf('id="studentPanelTrend"'));
});
