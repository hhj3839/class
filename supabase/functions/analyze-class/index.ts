const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const text=(value:unknown,max=700)=>String(value||'').trim().slice(0,max);
const internalLabelMap:[RegExp,string][]=[
  [/직접 호소/g,'학생이 작성한 서술'],[/직접 경험/g,'경험 여부가 확인되지 않은 서술'],[/직접 목격/g,'목격 여부가 확인되지 않은 서술'],
  [/received_average_delta/gi,'받은 관계 점수 평균 변화'],[/received_relationships/gi,'받은 관계 평가'],[/monthly_changes/gi,'전월 대비 변화'],[/self_rating_deltas/gi,'자기평가 변화'],
  [/needsHelp/gi,'도움 필요 친구 문항'],[/teacherWish/gi,'선생님께 듣고 싶은 말'],[/helpNow/gi,'도움 요청'],[/unresolved/gi,'아직 속상한 마음이 남은 관계 문항'],
  [/responsibility/gi,'책임감'],[/listening/gi,'경청'],[/respect/gi,'관계 존중'],[/manners/gi,'예의'],[/study/gi,'학습'],
  [/peer/gi,'친구 관찰'],[/hurt/gi,'상처 행동 문항'],[/growth/gi,'긍정적 변화 문항'],[/kind/gi,'친절·존중 문항'],[/ratings/gi,'자기평가']
];
const localizeAnalysisValues=(value:unknown):unknown=>{
  if(typeof value==='string')return internalLabelMap.reduce((result,[pattern,label])=>result.replace(pattern,label),value);
  if(Array.isArray(value))return value.map(localizeAnalysisValues);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,localizeAnalysisValues(item)]));
  return value;
};

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405);
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return json({error:'교사 로그인이 필요합니다.'},401);
  try{
    const {classId,month,force=false}=await request.json();
    if(!classId||!/^\d{4}-\d{2}$/.test(month||''))return json({error:'학급과 분석 월을 확인해 주세요.'},400);
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!,openaiKey=Deno.env.get('OPENAI_API_KEY');
    if(!openaiKey)return json({error:'서버 AI 비밀값이 설정되지 않았습니다.'},503);
    const callRpc=async(name:string,body:Record<string,unknown>)=>{const response=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json().catch(()=>null);if(!response.ok)throw new Error(value?.message||value?.error||'DB 작업에 실패했습니다.');return value};
    const surveyMonth=`${month}-01`;
    if(!force){const cached=await callRpc('teacher_get_cached_ai_analysis_auth',{p_class_id:classId,p_survey_month:surveyMonth});if(cached?.[0]){const row=cached[0];return json({analysis:row.result_json,meta:{runId:row.id,model:row.model,month,responseCount:row.response_count,generatedAt:row.created_at,reviewStatus:row.review_status,cached:true}})}}
    const runId=await callRpc('teacher_begin_ai_analysis_auth',{p_class_id:classId,p_survey_month:surveyMonth});
    const rpc=await fetch(`${supabaseUrl}/rest/v1/rpc/teacher_get_responses_auth`,{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_class_id:classId})});
    const rows=await rpc.json().catch(()=>null);
    if(!rpc.ok)return json({error:rpc.status===401?'로그인이 만료되었습니다.':'담당 학급 권한을 확인해 주세요.'},rpc.status===401?401:403);
    const latest=new Map<number,any>();
    (rows||[]).filter((row:any)=>String(row.survey_month||'').slice(0,7)===month&&!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{if(!latest.has(Number(row.student_number)))latest.set(Number(row.student_number),row)});
    if(!latest.size)return json({error:'선택한 월에 분석할 응답이 없습니다.'},400);
    const previousDate=new Date(`${month}-01T00:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-1);const previousMonth=previousDate.toISOString().slice(0,7),previousLatest=new Map<number,any>();
    (rows||[]).filter((row:any)=>String(row.survey_month||'').slice(0,7)===previousMonth&&!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{if(!previousLatest.has(Number(row.student_number)))previousLatest.set(Number(row.student_number),row)});
    const evidence=[...latest.values()].map((row:any)=>{const number=Number(row.student_number),p=row.payload_json||{},ratings=p.selfRatings||{},peer=p.peerObservations||{},state=p.studentState||{},before=previousLatest.get(number)?.payload_json||{},beforeRatings=before.selfRatings||{},ratingDeltas=Object.fromEntries(Object.keys(ratings).map(key=>[key,Number(ratings[key]?.score)-Number(beforeRatings[key]?.score)]).filter(([,value])=>Number.isFinite(value)));return{
      student:`학생-${Number(row.student_number)}`,
      ratings:Object.fromEntries(Object.entries(ratings).map(([key,value]:any)=>[key,{score:Number(value?.score)||null,reason:text(value?.reason,220)}])),
      helpNow:text(p.helpNow,80),worry:text(state.worryDetail),teacherWish:text(state.teacherWish,350),
      peer:{kind:text(peer.kind?.detail),growth:text(peer.growth?.detail),hurt:text(peer.hurt?.detail),needsHelp:text(peer.needsHelp?.detail)},
      unresolved:text(p.unresolved?.detail),relationships:(p.relationships||[]).slice(0,40).map((item:any)=>({target:`학생-${Number(item.targetNumber)}`,score:Number(item.score)})),
      monthly_changes:previousLatest.has(number)?{from:previousMonth,to:month,self_rating_deltas:ratingDeltas,previous_helpNow:text(before.helpNow,80),previous_worry:text(before.studentState?.worryDetail,350)}:null
    }});
    const received=new Map<string,number[]>();
    evidence.forEach(row=>row.relationships.forEach(item=>{if(!received.has(item.target))received.set(item.target,[]);received.get(item.target)!.push(item.score)}));
    const previousReceived=new Map<string,number[]>();previousLatest.forEach((row:any)=>{(row.payload_json?.relationships||[]).forEach((item:any)=>{const target=`학생-${Number(item.targetNumber)}`;if(!previousReceived.has(target))previousReceived.set(target,[]);previousReceived.get(target)!.push(Number(item.score))})});
    evidence.forEach(row=>{const values=received.get(row.student)||[],beforeValues=previousReceived.get(row.student)||[],average=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,beforeAverage=beforeValues.length?beforeValues.reduce((sum,value)=>sum+value,0)/beforeValues.length:null;(row as any).received_relationships=values.length?{count:values.length,average:Number(average!.toFixed(2)),low_count:values.filter(value=>value<=2).length,high_count:values.filter(value=>value>=4).length,scores:values}:null;if((row as any).monthly_changes)(row as any).monthly_changes.received_average_delta=average!==null&&beforeAverage!==null?Number((average-beforeAverage).toFixed(2)):null});
    const typedEvidence={type:'string',pattern:'^\\[(계산 결과|학생 원문|친구 관찰)\\]'};
    const schema={type:'object',additionalProperties:false,properties:{overall_judgment:{type:'string'},priority_students:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{student:{type:'string'},priority:{type:'string',enum:['즉시 확인','지속 관찰']},evidence:{type:'array',items:typedEvidence,maxItems:4},possible_interpretations:{type:'array',items:{type:'string'},maxItems:3},coaching_direction:{type:'string'},teacher_checks:{type:'array',items:{type:'string'},maxItems:3}},required:['student','priority','evidence','possible_interpretations','coaching_direction','teacher_checks']}},class_patterns:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,properties:{pattern:{type:'string'},evidence:{type:'array',items:typedEvidence,maxItems:4},teacher_check:{type:'string'}},required:['pattern','evidence','teacher_check']}},limitations:{type:'array',items:{type:'string'},maxItems:5}},required:['overall_judgment','priority_students','class_patterns','limitations']};
    const prompt=`당신은 초등학교 담임교사의 관찰을 돕는 보조 분석가입니다. ${month} 설문을 분석하세요. 학생별로 친구들에게 받은 관계 평가, 자기평가, 서술 응답과 전월 변화를 함께 비교하며 단일 시점보다 반복·변화를 우선하세요. 의미 있는 복수 신호나 즉시 도움 요청이 있는 학생만 주의 깊게 볼 학생으로 최대 3명까지 선정하세요. 근거가 약하면 3명을 채우지 말고 빈 배열 또는 필요한 인원만 반환하세요. 학생 간 순위는 만들지 마세요. 모든 evidence 문장은 반드시 [계산 결과], [학생 원문], [친구 관찰] 중 하나로 시작하고 AI의 추측은 evidence에 넣지 마세요. 내부 JSON 필드명이나 영문 변수명을 결과에 절대 복사하지 말고 교사가 이해할 수 있는 한국어 항목명으로 바꾸세요. 특히 peer, hurt, needsHelp, unresolved, monthly_changes, responsibility, received_average_delta 같은 문자열을 출력하지 마세요. 관계 평균이나 비율을 근거로 쓸 때는 반드시 해당 응답자 수 또는 응답 건수를 함께 쓰세요. 현재 입력에는 직접 경험·직접 목격·전해 들음의 구분 정보가 없으므로 '직접 호소', '직접 경험', '직접 목격'이라고 확정하지 말고 '학생이 작성한 서술'이라고 표현하세요. 입력 근거와 복수의 가능한 해석, 담임 관찰 포인트, 구체적인 코칭 방향을 제시하고 전체 결과를 아우르는 종합 판단도 작성하세요. 학생을 진단·낙인·확정하지 말고 입력에 직접 있는 근거만 쓰세요. 이름은 입력의 학생-N 표기를 그대로 유지하세요. 폭력·자해·즉각적 도움 요청은 즉시 확인으로 우선 표시하세요. 결석·미제출은 부정 신호로 해석하지 마세요. 관계 점수만으로 고립이나 집단을 확정하지 마세요. 가능한 해석은 복수 가설로, 교사 확인은 실제 관찰이나 비공개 대화 질문으로 제안하세요. 학생-N 표기를 제외한 모든 자연어 값은 반드시 자연스럽고 이해하기 쉬운 한국어로 작성하세요. 영어 문장, 영어 제목, 영어 우선순위 표기는 사용하지 마세요.`;
    const model='gpt-5.4-mini';
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,reasoning:{effort:'low'},instructions:prompt,input:JSON.stringify({response_count:evidence.length,responses:evidence}),max_output_tokens:2600,text:{format:{type:'json_schema',name:'class_support_analysis',strict:true,schema}}})});
    const result=await ai.json().catch(()=>null);
    if(!ai.ok){const requestId=ai.headers.get('x-request-id')||'';console.error('OpenAI API request failed',{status:ai.status,code:result?.error?.code||'',type:result?.error?.type||'',message:text(result?.error?.message,500),requestId});await callRpc('teacher_fail_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_request_id:requestId}).catch(()=>null);return json({error:'AI 분석 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',requestId},502)}
    const outputText=(result?.output||[]).flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text;
    if(!outputText){await callRpc('teacher_fail_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_request_id:ai.headers.get('x-request-id')||''}).catch(()=>null);return json({error:'AI 분석 결과를 읽지 못했습니다.'},502)}
    const analysis=localizeAnalysisValues(JSON.parse(outputText)),generatedAt=new Date().toISOString();
    await callRpc('teacher_complete_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_result:analysis,p_model:model,p_response_count:evidence.length,p_request_id:ai.headers.get('x-request-id')||''});
    return json({analysis,meta:{runId,model,month,responseCount:evidence.length,generatedAt,cached:false}});
  }catch(error){return json({error:error instanceof Error?error.message:'서버 분석 중 오류가 발생했습니다.'},500)}
});
