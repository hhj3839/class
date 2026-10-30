const {test,expect}=require('@playwright/test');
test('화면과 PDF의 요청별 지원 방향 일치·전체 원문·인원 표기',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const {groundClassAnalysis}=await import('../supabase/functions/analyze-class/grounding.mjs');
 const rows=['공부를 알려주세요','학원 끝어주세요','화를 적게 내주세요'].map((value,i)=>({id:'p'+i,student_number:i+1,survey_month:'2026-09-01',submitted_at:'2026-09-01',payload_json:{studentState:{parentWish:value,worryDetail:'도움 요청'}}}));
 const analysis=groundClassAnalysis({priority_students:rows.map(r=>({student:'학생-'+r.student_number,source_refs:[r.id+'|studentState.worryDetail']})),class_patterns:[]},rows,'2026-09');
 const result=await page.evaluate(({analysis})=>{
  classSettings.students=[1,2,3].map(number=>({number,name:'가상'+number}));
  renderAiAnalysis({analysis,meta:{month:'2026-09',cached:true}});
  const pdf=document.createElement('div');pdf.innerHTML=buildAiReportSection('class',0,true);
  return {screen:[...document.querySelectorAll('#classObservationPatterns .parent-support-direction')].map(e=>e.textContent),pdf:[...pdf.querySelectorAll('.parent-support-direction')].map(e=>e.textContent),text:pdf.textContent,counts:['학생 3명','학생 13명','학생 3 명','학생-3','3번 학생'].map(aiTeacherDisplayText)};
 },{analysis});
 expect(result.pdf).toEqual(result.screen);expect(result.pdf).toHaveLength(3);
 for(const value of ['공부를 알려주세요','학원 끝어주세요','화를 적게 내주세요','학생 3명'])expect(result.text).toContain(value);
 expect(result.counts).toEqual(['학생 3명','학생 13명','학생 3 명','가상3','가상3']);
});
