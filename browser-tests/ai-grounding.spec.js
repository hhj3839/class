const {test,expect}=require('@playwright/test');

test('도움 요청 선택 집계는 선택 월 최신 유효 응답만 사용하고 AI 신호와 분리한다',async({page})=>{
  await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
  await page.goto('./');
  const result=await page.evaluate(()=>{
    selectedAnalysisMonth='2026-09';
    const row=(number,month,help,time,excluded=false)=>({id:`${number}-${month}-${time}`,student_number:number,student_name:`가상${number}`,survey_month:`${month}-01`,submitted_at:`${month}-${time}T00:00:00Z`,analysis_excluded:excluded,payload_json:{helpNow:help}});
    allResponses=[row(1,'2026-09','즉시','01'),row(1,'2026-09','괜찮음','02'),row(2,'2026-09','이번 주','01'),row(3,'2026-08','즉시','01'),row(4,'2026-09','즉시','01',true),row(5,'2026-09','즉시','01')];
    signals=[{type:'urgent',student_name:'AI 확인 대상'}, {type:'urgent',student_name:'다른 월 학생'}];
    renderClassResponseFlowMetrics();
    return {data:classResponseFlowData(),text:document.querySelector('#classResponseFlowMetrics').textContent,label:labelAtPath('helpNow')};
  });
  expect(result.data.immediate).toBe(1);
  expect(result.data.thisWeek).toBe(1);
  expect(result.label).toBe('도움 요청');
  expect(result.text).toContain('도움 요청 선택');
  expect(result.text).toContain('이번 주 1명');
  expect(result.text).toContain('AI 확인 대상과 별도');
  expect(result.text).not.toContain('바로 확인할 응답');
});
test('검증 보류는 이전 카드와 PDF용 상태를 비우고 근거 없는 대체 원문을 만들지 않는다',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const result=await page.evaluate(()=>{
  renderAiAnalysis({analysis:{priority_students:[{student:'학생-3',attention_reason:'잘못된 과거 해석',source_refs:[]}],class_patterns:[]},meta:{month:'2026-09'}});
  renderAiAnalysis({empty:true,validationBlocked:true,analysis:null,meta:{month:'2026-09',cached:true}});
  allResponses=[{id:'r',student_number:3,survey_month:'2026-09-01',payload_json:{studentState:{worryDetail:'대체하면 안 되는 내용'}}}];
  openAiSourceEvidence({student:'학생-3',source_refs:['missing|helpNow']});
  return {card:document.querySelector('#aiAnalysisContent').textContent,patterns:document.querySelector('#classObservationPatterns').textContent,pdf:currentAiAnalysis,dialog:document.querySelector('#dialogContent').textContent};
 });
 expect(result.card).toContain('표시 보류');expect(result.patterns).toContain('표시 보류');expect(result.card).not.toContain('잘못된 과거 해석');expect(result.pdf).toBeNull();expect(result.dialog).not.toContain('대체하면 안 되는 내용');expect(result.dialog).toContain('연결된 원문을 찾지 못했습니다');
});
