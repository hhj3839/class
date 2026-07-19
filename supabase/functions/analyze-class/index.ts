const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const text=(value:unknown,max=700)=>String(value||'').trim().slice(0,max);

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405);
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return json({error:'교사 로그인이 필요합니다.'},401);
  try{
    const {classId,month}=await request.json();
    if(!classId||!/^\d{4}-\d{2}$/.test(month||''))return json({error:'학급과 분석 월을 확인해 주세요.'},400);
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!,openaiKey=Deno.env.get('OPENAI_API_KEY');
    if(!openaiKey)return json({error:'서버 AI 비밀값이 설정되지 않았습니다.'},503);
    const rpc=await fetch(`${supabaseUrl}/rest/v1/rpc/teacher_get_responses_auth`,{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_class_id:classId})});
    const rows=await rpc.json().catch(()=>null);
    if(!rpc.ok)return json({error:rpc.status===401?'로그인이 만료되었습니다.':'담당 학급 권한을 확인해 주세요.'},rpc.status===401?401:403);
    const latest=new Map<number,any>();
    (rows||[]).filter((row:any)=>String(row.survey_month||'').slice(0,7)===month&&!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{if(!latest.has(Number(row.student_number)))latest.set(Number(row.student_number),row)});
    if(!latest.size)return json({error:'선택한 월에 분석할 응답이 없습니다.'},400);
    const evidence=[...latest.values()].map((row:any)=>{const p=row.payload_json||{},ratings=p.selfRatings||{},peer=p.peerObservations||{},state=p.studentState||{};return{
      student:`학생-${Number(row.student_number)}`,
      ratings:Object.fromEntries(Object.entries(ratings).map(([key,value]:any)=>[key,{score:Number(value?.score)||null,reason:text(value?.reason,220)}])),
      helpNow:text(p.helpNow,80),worry:text(state.worryDetail),teacherWish:text(state.teacherWish,350),
      peer:{kind:text(peer.kind?.detail),growth:text(peer.growth?.detail),hurt:text(peer.hurt?.detail),needsHelp:text(peer.needsHelp?.detail)},
      unresolved:text(p.unresolved?.detail),relationships:(p.relationships||[]).slice(0,40).map((item:any)=>({target:`학생-${Number(item.targetNumber)}`,score:Number(item.score)}))
    }});
    const schema={type:'object',additionalProperties:false,properties:{summary:{type:'string'},priority_students:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,properties:{student:{type:'string'},priority:{type:'string',enum:['즉시 확인','이번 주 확인','지속 관찰']},evidence:{type:'array',items:{type:'string'},maxItems:4},possible_interpretations:{type:'array',items:{type:'string'},maxItems:3},teacher_checks:{type:'array',items:{type:'string'},maxItems:3}},required:['student','priority','evidence','possible_interpretations','teacher_checks']}},class_patterns:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,properties:{pattern:{type:'string'},evidence:{type:'array',items:{type:'string'},maxItems:4},teacher_check:{type:'string'}},required:['pattern','evidence','teacher_check']}},limitations:{type:'array',items:{type:'string'},maxItems:5}},required:['summary','priority_students','class_patterns','limitations']};
    const prompt=`당신은 초등학교 담임교사의 관찰을 돕는 보조 분석가입니다. ${month} 설문을 분석하세요. 학생을 진단·낙인·확정하지 말고 입력에 직접 있는 근거만 쓰세요. 이름은 입력의 학생-N 표기를 그대로 유지하세요. 폭력·자해·즉각적 도움 요청은 즉시 확인으로 우선 표시하세요. 결석·미제출은 부정 신호로 해석하지 마세요. 관계 점수만으로 고립이나 집단을 확정하지 마세요. 가능한 해석은 복수 가설로, 교사 확인은 실제 관찰이나 비공개 대화 질문으로 제안하세요.`;
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-terra',reasoning:{effort:'low'},instructions:prompt,input:JSON.stringify({response_count:evidence.length,responses:evidence}),max_output_tokens:2600,text:{format:{type:'json_schema',name:'class_support_analysis',strict:true,schema}}})});
    const result=await ai.json().catch(()=>null);
    if(!ai.ok)return json({error:'AI 분석 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',requestId:ai.headers.get('x-request-id')},502);
    const outputText=(result?.output||[]).flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text;
    if(!outputText)return json({error:'AI 분석 결과를 읽지 못했습니다.'},502);
    return json({analysis:JSON.parse(outputText),meta:{model:'gpt-5.6-terra',month,responseCount:evidence.length,generatedAt:new Date().toISOString()}});
  }catch(error){return json({error:error instanceof Error?error.message:'서버 분석 중 오류가 발생했습니다.'},500)}
});
