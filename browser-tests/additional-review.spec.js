const {test,expect}=require('@playwright/test');
test('저장 결과·미생성·월 변경·로그아웃의 추가 확인 원문 표시',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const output=await page.evaluate(()=>{
  selectedAnalysisMonth='2026-09';allResponses=[{id:'a',student_number:7,survey_month:'2026-09-01',payload_json:{studentState:{parentWish:'<img src=x onerror=alert(1)> 공부를 알려주세요'},peerObservations:{hurt:{detail:'다른 반 친구가 놀림',sourceType:'직접 목격',frequency:'한 번',ongoing:false}}}}];
  renderAiAnalysis({analysis:{priority_students:[],class_patterns:[]},meta:{month:'2026-09',cached:true}});
  const initial=document.querySelector('#additionalResponses').textContent,images=document.querySelectorAll('#additionalResponses img').length;
  renderAiAnalysis({empty:true,validationBlocked:true});const blocked=document.querySelector('#additionalResponses').textContent;
  selectedAnalysisMonth='2026-10';renderAdditionalResponses();const next=document.querySelector('#additionalResponses').textContent;
  clearSensitiveState();const logout=document.querySelector('#additionalResponses').textContent;
  return {initial,images,blocked,next,logout};
 });
 expect(output.initial).toContain('부모님께 바라는 점');expect(output.initial).toContain('다른 반 친구가 놀림');expect(output.initial).toContain('직접 목격');expect(output.images).toBe(0);
 expect(output.blocked).toContain('공부를 알려주세요');expect(output.next).not.toContain('공부를 알려주세요');expect(output.logout).not.toContain('공부를 알려주세요');
});
