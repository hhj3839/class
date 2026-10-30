const {test,expect}=require('@playwright/test');
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
