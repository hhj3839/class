const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('student-coaching.js','utf8');const helper=source.slice(source.indexOf('function coachingLastAnalysisMeta('),source.indexOf('function renderStudentCoachingCard('));
const context={Intl,Date,monthLabel:m=>`${m.slice(0,4)}년 ${Number(m.slice(5,7))}월`};vm.createContext(context);vm.runInContext(helper,context);
test('코칭 상단은 실제 저장 시각을 한국 시간으로 표시하고 카드 기준 월을 우선한다',()=>{
 const data={cached:true,basisMonth:'2026-09',card:{generatedAt:'2026-09-11T15:16:46Z',basisMonth:'2026-08',model:'gpt-5.6-terra'}};
 assert.equal(context.coachingLastAnalysisMeta(data),'마지막 분석 2026. 09. 12. 00:16:46 · 2026년 8월 자료 기준 · 저장 결과 · gpt-5.6-terra');
 assert.match(context.coachingLastAnalysisMeta({...data,cached:false}),/새 분석/);
 assert.equal(context.coachingLastAnalysisMeta(data),context.coachingLastAnalysisMeta({...data,quotaCheckedAt:Date.now()}));
});
test('없는 카드나 잘못된 생성일에 현재 시각을 만들어 표시하지 않는다',()=>{
 assert.equal(context.coachingLastAnalysisMeta({}),'마지막 분석: 현재 자료의 저장 결과 없음');
 assert.match(context.coachingLastAnalysisMeta({card:{generatedAt:'invalid'}}),/생성 시각 확인 불가/);
 assert.match(context.coachingLastAnalysisMeta({card:{}}),/생성 시각 확인 불가/);
});
