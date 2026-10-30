const {test,expect}=require('@playwright/test');

test('긴 월간 PDF는 줄·표 행을 자르지 않고 제목 뒤 공간과 모든 원문을 보존한다',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({json:[]}));
 await page.goto('./');
 const result=await page.evaluate(async()=>{
  const slices=[],sources=[],placements=[];let current=1,bytes;
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source._audit)slices.push({id:source._audit.id,start:args[1],end:args[1]+args[3]});return original.call(this,source,...args)};
  function Pdf(options){const pdf=new jspdf.jsPDF(options),add=pdf.addImage.bind(pdf),next=pdf.addPage.bind(pdf);pdf.addPage=(...args)=>{current++;return next(...args)};pdf.addImage=(...args)=>{placements.push({page:current,y:args[3],h:args[5]});return add(...args)};pdf.save=()=>{bytes=pdf.output('arraybuffer').byteLength};return pdf}
  const html='<header style="height:180px">가상 월간 보고서</header><h2>긴 근거</h2><article><p>'+('Synthetic evidence with varied words and spaces. '.repeat(260))+'EVIDENCE_END</p></article><h2>월별 추세</h2><table><tbody>'+Array.from({length:80},(_,i)=>`<tr><td>가상 월 ${i}</td><td>3명</td><td>100%</td><td>3.0</td></tr>`).join('')+'</tbody></table>';
  try{await IeumPdfDownload.create({document,getPdfConstructor:()=>Pdf,getCanvasRenderer:()=>async el=>{
   const canvas=await html2canvas(el,{scale:2,logging:false}),rect=el.getBoundingClientRect(),scale=canvas.width/rect.width,ranges=[];
   const walker=document.createTreeWalker(el,4);while(walker.nextNode()){const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const box of range.getClientRects())if(box.height)ranges.push([(box.top-rect.top)*scale,(box.bottom-rect.top)*scale])}
   for(const row of el.querySelectorAll('tr')){const box=row.getBoundingClientRect();ranges.push([(box.top-rect.top)*scale,(box.bottom-rect.top)*scale])}
   canvas._audit={id:sources.length};sources.push({height:canvas.height,ranges,text:el.textContent});return canvas;
  }}).downloadPdfDocument(html,'가상 월간');}finally{CanvasRenderingContext2D.prototype.drawImage=original}
  return{sources,slices,placements,bytes};
 });
 expect(result.bytes).toBeGreaterThan(1000);
 expect(result.placements[1].page).toBe(result.placements[2].page);
 expect(result.sources.some(s=>s.text.endsWith('EVIDENCE_END'))).toBe(true);
 expect(result.slices.length).toBeGreaterThan(2);
 for(const [id,source] of result.sources.entries()){
  const slices=result.slices.filter(s=>s.id===id);if(!slices.length)continue;
  expect(slices[0].start).toBe(0);expect(slices.at(-1).end).toBe(source.height);
  for(let i=0;i<slices.length;i++){
   if(i)expect(slices[i].start).toBe(slices[i-1].end);
   if(i<slices.length-1)expect(source.ranges.some(([top,bottom])=>top<slices[i].end&&bottom>slices[i].end)).toBe(false);
  }
 }
 for(const p of result.placements)expect(p.y+p.h).toBeLessThanOrEqual(281.01);
});
