const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
for(const id of ['runAiAnalysis','runPatternsAi'])test(`${id}: actual click handler passes false without confirmation`,async()=>{
  const buttons=new Map();let payload,confirms=0;
  const context={$:key=>{if(!buttons.has(key))buttons.set(key,{disabled:false,textContent:'조회',addEventListener(type,fn){this.click=fn}});return buttons.get(key)},getTeacherSession:()=>true,confirm:()=>{confirms++;return true},teacherEdgeFunction:async(_,body)=>{payload=body;return{meta:{cached:true}}},renderAiAnalysis:()=>{},showToast:()=>{},classSettings:{classId:'fixture'},selectedAnalysisMonth:'2026-09'};
  vm.createContext(context);
  vm.runInContext(source.split(/\r?\n/).find(line=>line.startsWith('async function runAiAnalysis(')),context);
  vm.runInContext(source.split(/\r?\n/).find(line=>line.startsWith(`$('#${id}').addEventListener`)),context);
  await buttons.get('#'+id).click({type:'click',isTrusted:true});
  assert.equal(confirms,0);assert.equal(payload.force,false);
});
