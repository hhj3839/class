const {test,expect}=require('@playwright/test');
test('부모 요청별 지원 방향 전체 문구와 요약 3명 유지',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=['공부를 알려주세요','학원 끝어주세요','화를 적게 내주세요'].map((value,i)=>({id:'p'+i,student_number:i+1,survey_month:'2026-09-01',submitted_at:'2026-09-01',payload_json:{studentState:{parentWish:value,worryDetail:'도움 요청'}}}));
 const analysis=groundClassAnalysis({priority_students:rows.map(r=>({student:'학생-'+r.student_number,source_refs:[r.id+'|studentState.worryDetail']})),class_patterns:[]},rows,'2026-09');
 const result=await page.evaluate(({analysis})=>{renderAiAnalysis({analysis,meta:{month:'2026-09',cached:true}});return {text:document.querySelector('#classObservationPatterns').textContent,summary:document.querySelector('#aiAnalysisContent').textContent};},{analysis});
 for(const label of ['학습 도움 요청','학원 관련 요청','화 표현 관련 요청','부담이나 중단 필요성을 단정하지 않습니다.','가정 상황을 단정하지 않습니다.','개인 응답은 공개하지 않습니다.'])expect(result.text).toContain(label);
 expect(result.summary).toContain('먼저 살펴볼 학생 3명');
});
