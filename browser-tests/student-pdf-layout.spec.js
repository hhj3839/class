const {test,expect}=require('@playwright/test');

test('학생 PDF는 코칭과 모든 원문을 보존하며 제목을 다음 카드와 묶는다',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const result=await page.evaluate(async()=>{
  const item={text:'학생의 이야기를 듣고 원하는 도움을 확인합니다.',refs:['E1','E2','E3']};
  const data={card:{result:{summary:item,question:item,actions:[{title:'어려움을 말하면',steps:['학생의 말을 되짚습니다.','원하는 변화를 묻습니다.'],refs:['E1']}],check_after:'시도하지 않아도 괜찮습니다.'}},sources:[1,2,3].map(i=>({id:'E'+i,month:'2026-09',label:'문항 '+i,value:'가상 학생 원문 '+i,kind:'survey'}))};
  const html='<header><h1>가상 학생 기록</h1></header>'+buildStudentCoachingPdfSection(data,{includeOriginals:true});
  const placements=[];let current=1;
  class Pdf{addPage(){current++}getNumberOfPages(){return current}addImage(text,_type,_x,y,_w,h){placements.push({text,page:current,y,h})}setPage(){}setDrawColor(){}line(){}setFontSize(){}setTextColor(){}text(){}save(){}}
  await IeumPdfDownload.create({document,getPdfConstructor:()=>Pdf,getCanvasRenderer:()=>async element=>{const rect=element.getBoundingClientRect();return{width:rect.width,height:rect.height,toDataURL:()=>element.textContent}}}).downloadPdfDocument(html,'검증');
  return {placements,pages:current};
 });
 const text=result.placements.map(p=>p.text).join('\n');
 for(const expected of ['가상 학생 원문 1','가상 학생 원문 2','가상 학생 원문 3','시도하지 않아도 괜찮습니다.'])expect(text).toContain(expected);
 for(const title of ['학생 코칭','코칭 근거 원문']){const index=result.placements.findIndex(p=>p.text.startsWith(title));expect(index).toBeGreaterThan(-1);expect(result.placements[index].page).toBe(result.placements[index+1].page)}
 expect(result.placements[1].page).toBe(1);
 expect(result.pages).toBeLessThanOrEqual(2);
 for(const block of result.placements)expect(block.y+block.h).toBeLessThanOrEqual(281.01);
});

test('학생 코칭 PDF 실제 렌더링·다운로드',async({page},testInfo)=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const bytes=await page.evaluate(async()=>{
  const item={text:'학습에서 어려웠던 장면을 함께 살펴보고 학생이 원하는 도움을 묻습니다.',refs:['E1','E2','E3']};
  const data={card:{result:{summary:item,question:{...item,text:'요즘 공부할 때 기억나는 일은 무엇이니?'},actions:[{title:'어려움을 이야기하면',steps:['학생의 말을 짧게 되짚고 맞는지 확인합니다.','어떻게 달라지면 좋을지 학생에게 묻습니다.'],refs:['E1']},{title:'원하는 변화를 이야기하면',steps:['이미 도움이 되었던 경험을 묻습니다.','학생이 원하는 작은 시도를 함께 살펴봅니다.'],refs:['E2']}],check_after:'선택할 때: 지금 정하지 않아도 괜찮아.\n시도한 뒤: 해 보니 어땠니?'}},sources:[1,2,3].map(i=>({id:'E'+i,month:'2026-09',label:'가상 문항 '+i,value:'공부할 때 질문하는 연습을 해 보고 싶어요. '+i,kind:'survey'}))};
  const html='<header><h1>가상 학생 기록</h1><p>2026학년도 · 최근 응답 2026-09</p></header><section class="pdf-ai-section"><section class="pdf-block pdf-comparison-heading"><h2>학생 한눈에 보기</h2></section><article class="pdf-block pdf-coaching-compact"><h3>최근 학교생활 고민</h3><p>공부할 때 도움이 필요해요.</p></article></section>'+buildStudentCoachingPdfSection(data,{includeOriginals:true});
  let bytes;function Pdf(options){const pdf=new jspdf.jsPDF(options);pdf.save=()=>{bytes=Array.from(new Uint8Array(pdf.output('arraybuffer')))};return pdf}
  await IeumPdfDownload.create({document,getPdfConstructor:()=>Pdf,getCanvasRenderer:()=>html2canvas}).downloadPdfDocument(html,'가상 학생');
  return bytes;
 });
 expect(String.fromCharCode(...bytes.slice(0,4))).toBe('%PDF');
 require('node:fs').writeFileSync(testInfo.outputPath('student-layout.pdf'),Buffer.from(bytes));
});
