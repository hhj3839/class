const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const text=(value:unknown,max=700)=>String(value||'').trim().slice(0,max);
const analysisVersion='2026.07.23-student-support-v15';
const relationshipAnalysisVersion='2026.07.23-relationship-coaching-v9';
const openAiTimeoutMs=45000;
const internalLabelMap:[RegExp,string][]=[
  [/직접 호소/g,'학생이 작성한 서술'],[/직접 경험/g,'경험 여부가 확인되지 않은 서술'],[/직접 목격/g,'목격 여부가 확인되지 않은 서술'],
  [/received_average_delta/gi,'받은 관계 점수 평균 변화'],[/received_relationships/gi,'받은 관계 평가'],[/monthly_changes/gi,'전월 대비 변화'],[/self_rating_deltas/gi,'자기평가 변화'],
  [/needsHelp/gi,'도움 필요 친구 문항'],[/teacherWish/gi,'선생님께 듣고 싶은 말'],[/helpNow/gi,'도움 요청'],[/unresolved/gi,'아직 속상한 마음이 남은 관계 문항'],
  [/responsibility/gi,'책임감'],[/listening/gi,'경청'],[/respect/gi,'관계 존중'],[/manners/gi,'예의'],[/study/gi,'학습'],
  [/peer/gi,'친구 관찰'],[/hurt/gi,'상처 행동 문항'],[/growth/gi,'긍정적 변화 문항'],[/kind/gi,'친절·존중 문항'],[/ratings/gi,'자기평가'],
  [/도움 요청가/g,'도움 요청이'],[/도움 요청는/g,'도움 요청은'],[/도움 요청를/g,'도움 요청을']
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
  let runId='';
  let failAnalysis:((reason:string,requestId?:string)=>Promise<void>)|null=null;
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
    const authResponse=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:authorization}});
    const authUser=await authResponse.json().catch(()=>null);
    if(!authResponse.ok||!authUser?.id)return json({error:'교사 로그인이 필요합니다.'},401);
    const {classId,month,force=false,analysisType='class'}=await request.json();
    if(!['class','relationship'].includes(analysisType))return json({error:'지원하지 않는 분석 유형입니다.'},400);
    if(!classId||!/^\d{4}-\d{2}$/.test(month||''))return json({error:'학급과 분석 기준 월을 확인해 주세요.'},400);
    const openaiKey=Deno.env.get('OPENAI_API_KEY');
    if(!openaiKey)return json({error:'서버 AI 비밀값이 설정되지 않았습니다.'},503);
    const callRpc=async(name:string,body:Record<string,unknown>)=>{const response=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json().catch(()=>null);if(!response.ok)throw new Error(value?.message||value?.error||'DB 작업에 실패했습니다.');return value};
    const surveyMonth=`${month}-01`;
    const cachedRpc=analysisType==='relationship'?'teacher_get_cached_relationship_analysis_auth':'teacher_get_cached_ai_analysis_auth';
    const beginRpc=analysisType==='relationship'?'teacher_begin_relationship_analysis_auth':'teacher_begin_ai_analysis_auth';
    const selectedVersion=analysisType==='relationship'?relationshipAnalysisVersion:analysisVersion;
    if(!force){const cached=await callRpc(cachedRpc,{p_class_id:classId,p_survey_month:surveyMonth});if(cached?.[0]){const row=cached[0],cachedAnalysis=localizeAnalysisValues(row.result_json) as any,upgradeRecommended=analysisType==='relationship'&&!(cachedAnalysis?.insights||[]).every((item:any)=>text(item?.title,1)&&text(item?.timeframe,1));return json({analysis:cachedAnalysis,meta:{runId:row.id,model:row.model,month,responseCount:row.response_count,generatedAt:row.created_at,reviewStatus:row.review_status,cached:true,analysisVersion:upgradeRecommended?'이전 저장 형식':selectedVersion,analysisType,upgradeRecommended}})}}
    runId=await callRpc(beginRpc,{p_class_id:classId,p_survey_month:surveyMonth});
    failAnalysis=async(reason:string,requestId='')=>{await callRpc('teacher_fail_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_request_id:requestId,p_error_message:text(reason,500)}).catch(()=>null)};
    const rpc=await fetch(`${supabaseUrl}/rest/v1/rpc/teacher_get_responses_auth`,{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_class_id:classId})});
    const rows=await rpc.json().catch(()=>null);
    if(!rpc.ok){const message=rpc.status===401?'로그인이 만료되었습니다.':'담당 학급 권한을 확인해 주세요.';await failAnalysis(message);return json({error:message},rpc.status===401?401:403)}
    if(analysisType==='relationship'){
      const classContext=await callRpc('teacher_get_class_context_auth',{p_class_id:classId});
      const currentStudentNumbers=new Set<number>((classContext?.students||[]).map((student:any)=>Number(student.number)).filter((number:number)=>Number.isFinite(number)));
      if(!currentStudentNumbers.size){const message='현재 학급 명단에 관계 분석 대상 학생이 없습니다.';await failAnalysis(message);return json({error:message},400)}
      const monthlyLatest=new Map<string,any>();
      (rows||[]).filter((row:any)=>!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{const key=`${String(row.survey_month||'').slice(0,7)}:${Number(row.student_number)}`;if(!monthlyLatest.has(key))monthlyLatest.set(key,row)});
      const allRelationshipRows=[...monthlyLatest.values()].filter((row:any)=>currentStudentNumbers.has(Number(row.student_number))).map((row:any)=>({...row,payload_json:{...(row.payload_json||{}),relationships:(row.payload_json?.relationships||[]).filter((item:any)=>currentStudentNumbers.has(Number(item.targetNumber)))}})).filter((row:any)=>(row.payload_json?.relationships||[]).length);
      const months=[...new Set(allRelationshipRows.map((row:any)=>String(row.survey_month).slice(0,7)))].sort(),relationshipRows=allRelationshipRows.filter((row:any)=>String(row.survey_month).slice(0,7)===month);
      if(!relationshipRows.length){const message='선택한 달에 관계 분석에 사용할 응답이 없습니다.';await failAnalysis(message);return json({error:message},400)}
      const scores=new Map<string,number[]>();
      relationshipRows.forEach((row:any)=>(row.payload_json?.relationships||[]).forEach((item:any)=>{const key=`학생-${Number(row.student_number)}:학생-${Number(item.targetNumber)}`;if(!scores.has(key))scores.set(key,[]);scores.get(key)!.push(Number(item.score))}));
      const average=(values:number[])=>Number((values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2));
      const directed=[...scores.entries()].map(([pair,values])=>{const [from,to]=pair.split(':');return{from,to,average:average(values),months:values.length}});
      const mutual:any[]=[];directed.forEach(item=>{if(item.from>=item.to||item.average<4)return;const reverse=directed.find(other=>other.from===item.to&&other.to===item.from);if(reverse?.average>=4)mutual.push({students:[item.from,item.to],minimum_average:Math.min(item.average,reverse.average),sample_months:Math.min(item.months,reverse.months)})});
      const received=new Map<string,number[]>();directed.forEach(item=>{if(!received.has(item.to))received.set(item.to,[]);received.get(item.to)!.push(item.average)});
      const studentSummaries=[...received.entries()].map(([student,values])=>({student,response_count:values.length,received_average:average(values),high_count:values.filter(value=>value>=4).length,low_count:values.filter(value=>value<=2).length,range:Number((Math.max(...values)-Math.min(...values)).toFixed(2)),mutual_high_count:mutual.filter(item=>item.students.includes(student)).length}));
      const periodSummary=(periodRows:any[])=>{const periodScores=new Map<string,number>();periodRows.forEach((row:any)=>(row.payload_json?.relationships||[]).forEach((item:any)=>periodScores.set(`학생-${Number(row.student_number)}:학생-${Number(item.targetNumber)}`,Number(item.score))));const periodMutual:any[]=[];periodScores.forEach((score,key)=>{const [from,to]=key.split(':');if(from<to&&score>=4&&(periodScores.get(`${to}:${from}`)||0)>=4)periodMutual.push([from,to])});return{response_count:periodRows.length,directed_relationship_count:periodScores.size,mutual_high_relationships:periodMutual}};
      const previousMonth=months.filter(value=>value<month).at(-1)||'',selectedSummary=periodSummary(relationshipRows),previousSummary=previousMonth?periodSummary(allRelationshipRows.filter((row:any)=>String(row.survey_month).slice(0,7)===previousMonth)):null;
      const relationshipSchema={type:'object',additionalProperties:false,properties:{analysis_type:{type:'string',enum:['relationship']},summary:{type:'string'},insights:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},timeframe:{type:'string',enum:['이번 달에 보이는 변화','여러 달 이어진 관계 모습','응답이 적어 추가 확인 필요']},observation:{type:'string'},teacher_check:{type:'string'},class_coaching:{type:'string'},evidence:{type:'array',minItems:1,maxItems:2,items:{type:'string'}}},required:['title','timeframe','observation','teacher_check','class_coaching','evidence']}},limitations:{type:'array',maxItems:2,items:{type:'string'}}},required:['analysis_type','summary','insights','limitations']};
      const relationshipPrompt=`당신은 초등학교 담임교사가 선택한 달의 친구 관계 응답을 학급 운영에 활용하도록 돕는 보조 분석가입니다. 입력은 현재 학급 명단에 있는 학생만 남긴 학생-N 익명 번호와 1~5점 관계 응답 계산 결과입니다. 선택한 달을 중심으로 분석하고 이전 달 자료가 있을 때만 변화 여부를 조심스럽게 비교하세요. 결과는 학급 분석과 섞지 말고 관계 구조만 해석하세요. summary는 가장 중요한 우리 반 관계의 전체 모습을 80자 이내 한 문장으로 작성하세요. insights는 서로 겹치지 않는 핵심 관계 모습만 최대 2개 작성하세요. title은 짧은 명사형 제목으로 쓰고, observation에는 계산 결과로 확인되는 핵심 관계 모습을 80자 이내 한 문장으로 작성하세요. timeframe은 이전 달과 비교 근거가 있으면 '이번 달에 보이는 변화', 선택한 달에도 이전부터 이어진 근거가 확인되면 '여러 달 이어진 관계 모습', 응답이 부족하거나 비교할 이전 달이 없으면 '응답이 적어 추가 확인 필요' 중 하나를 선택하세요. 선택한 달에서 연결이 확인되지 않았다는 이유만으로 관계가 끊겼다고 표현하지 마세요. teacher_check에는 가장 적절한 교실 장면 하나와 확인할 행동 하나를 합쳐 50자 이내 한 문장으로만 작성하세요. class_coaching에는 특정 학생, 관계 점수, 인공지능을 언급하지 말고 담임이 학급 전체에 바로 말할 수 있는 자연스러운 권유형 문장 하나를 35~55자로 작성하세요. 추상적인 운영 표현 대신 학생이 수업이나 모둠 활동에서 곧바로 해볼 행동 하나를 담으세요. 예: '이번 활동에서는 아직 말하지 않은 친구의 의견도 한 번 들어 보자.' 같은 뜻을 observation, teacher_check, class_coaching에 반복하지 마세요. 학급 운영 방법은 별도 항목으로 만들지 마세요. evidence는 반드시 [계산 결과]로 시작하고 핵심 수치 하나를 포함하며 최대 2개만 작성하세요. 학생을 인기·고립·문제 학생으로 단정하거나 관계 원인을 추측하지 마세요. 특정 학생은 반드시 '학생-N 학생은', '학생-N 학생과'처럼 익명 번호 뒤에 '학생'을 붙여 언급하세요. 모든 자연어는 이해하기 쉬운 한국어로 작성하고 여러 문장이나 번호 목록으로 나누지 마세요. 영어 단어, 영어 문장, 영어 제목을 출력하지 마세요. 한국어 조사를 자연스럽게 사용하고 특히 '도움 요청가'가 아니라 '도움 요청이'라고 쓰세요.`;
      const model='gpt-5.4-mini';
      const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(openAiTimeoutMs),headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,reasoning:{effort:'low'},instructions:relationshipPrompt,input:JSON.stringify({selected_month:month,selected_month_summary:selectedSummary,selected_month_students:studentSummaries,selected_month_mutual_high_relationships:mutual,previous_month:previousMonth||null,previous_month_summary:previousSummary}),max_output_tokens:1800,text:{format:{type:'json_schema',name:'relationship_support_analysis',strict:true,schema:relationshipSchema}}})});
      const result=await ai.json().catch(()=>null);
      if(!ai.ok){const requestId=ai.headers.get('x-request-id')||'',detail=text(result?.error?.message,500)||`OpenAI 응답 코드 ${ai.status}`;await failAnalysis(detail,requestId);return json({error:`관계 AI 분석 요청에 실패했습니다. ${detail}`,requestId},502)}
      if(result?.status==='incomplete'){const message='관계 AI 분석 결과가 출력 한도 때문에 완성되지 않았습니다. 다시 시도해 주세요.';await failAnalysis(message,ai.headers.get('x-request-id')||'');return json({error:message},502)}
      const outputText=(result?.output||[]).flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text;
      if(!outputText){const message='관계 AI 분석 결과를 읽지 못했습니다.';await failAnalysis(message,ai.headers.get('x-request-id')||'');return json({error:message},502)}
      const analysis=localizeAnalysisValues(JSON.parse(outputText)),generatedAt=new Date().toISOString();
      await callRpc('teacher_complete_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_result:analysis,p_model:model,p_response_count:relationshipRows.length,p_request_id:ai.headers.get('x-request-id')||''});
      return json({analysis,meta:{runId,model,month,responseCount:relationshipRows.length,generatedAt,cached:false,analysisVersion:relationshipAnalysisVersion,analysisType}});
    }
    const latest=new Map<number,any>();
    (rows||[]).filter((row:any)=>String(row.survey_month||'').slice(0,7)===month&&!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{if(!latest.has(Number(row.student_number)))latest.set(Number(row.student_number),row)});
    if(!latest.size){const message='선택한 월에 분석할 응답이 없습니다.';await failAnalysis(message);return json({error:message},400)}
    const previousDate=new Date(`${month}-01T00:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-1);const previousMonth=previousDate.toISOString().slice(0,7),previousLatest=new Map<number,any>();
    (rows||[]).filter((row:any)=>String(row.survey_month||'').slice(0,7)===previousMonth&&!row.analysis_excluded).sort((a:any,b:any)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()).forEach((row:any)=>{if(!previousLatest.has(Number(row.student_number)))previousLatest.set(Number(row.student_number),row)});
    const evidence=[...latest.values()].map((row:any)=>{const number=Number(row.student_number),p=row.payload_json||{},ratings=p.selfRatings||{},peer=p.peerObservations||{},state=p.studentState||{},before=previousLatest.get(number)?.payload_json||{},beforeRatings=before.selfRatings||{},ratingDeltas=Object.fromEntries(Object.keys(ratings).map(key=>[key,Number(ratings[key]?.score)-Number(beforeRatings[key]?.score)]).filter(([,value])=>Number.isFinite(value)));return{
      student:`학생-${Number(row.student_number)}`,response_id:String(row.id),source_refs:[['studentState.worryDetail',state.worryDetail],['studentState.teacherWish',state.teacherWish],['peerObservations.kind.detail',peer.kind?.detail],['peerObservations.growth.detail',peer.growth?.detail],['peerObservations.hurt.detail',peer.hurt?.detail],['peerObservations.needsHelp.detail',peer.needsHelp?.detail],['unresolved.detail',p.unresolved?.detail],['helpNow',p.helpNow]].filter(([,value])=>text(value,20)).map(([field])=>`${row.id}|${field}`),
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
    const schema={type:'object',additionalProperties:false,properties:{overall_judgment:{type:'string'},priority_students:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{student:{type:'string'},priority:{type:'string',enum:['즉시 확인','지속 관찰']},attention_reason:{type:'string'},protective_factors:{type:'array',items:{type:'string'},maxItems:2},observation_points:{type:'array',maxItems:2,items:{type:'object',additionalProperties:false,properties:{context:{type:'string'},behavior:{type:'string'}},required:['context','behavior']}},coaching_directions:{type:'array',items:{type:'string'},maxItems:2},coaching_questions:{type:'array',items:{type:'string'},maxItems:2},avoid_actions:{type:'array',items:{type:'string'},maxItems:2},possible_interpretations:{type:'array',items:{type:'string'},maxItems:2},evidence:{type:'array',items:typedEvidence,maxItems:4},source_refs:{type:'array',items:{type:'string'},maxItems:4}},required:['student','priority','attention_reason','protective_factors','observation_points','coaching_directions','coaching_questions','avoid_actions','possible_interpretations','evidence','source_refs']}},class_patterns:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{pattern:{type:'string'},evidence:{type:'array',items:typedEvidence,maxItems:3},teacher_check:{type:'string'}},required:['pattern','evidence','teacher_check']}},limitations:{type:'array',items:{type:'string'},maxItems:5}},required:['overall_judgment','priority_students','class_patterns','limitations']};
    const prompt=`당신은 초등학교 담임교사의 관찰과 지원을 돕는 보조 분석가입니다. ${month} 설문을 분석하세요. 학생별로 친구들에게 받은 관계 평가, 자기평가, 서술 응답과 전월 변화를 함께 비교하며 단일 시점보다 반복·변화를 우선하세요. 의미 있는 복수 신호나 즉시 도움 요청이 있는 학생만 주의 깊게 볼 학생으로 최대 3명까지 선정하세요. 근거가 약하면 필요한 인원만 반환하고 학생 간 순위는 만들지 마세요. 결과는 담임 참고, 교실에서 살펴볼 점, 학생 코칭의 세 단계로 간결하게 작성하세요. attention_reason은 가장 중요한 해석만 80자 이내 한 문장으로 작성하세요. protective_factors에는 꼭 함께 알아야 할 긍정 요소 하나만 쓰고 근거가 없으면 빈 배열을 반환하세요. observation_points는 가장 중요한 한 개만 작성하고 context에는 장면, behavior에는 확인할 행동만 쓰세요. '이번 주', '이번 달', '다음 주'처럼 관찰 시기를 정하는 표현은 쓰지 마세요. 두 값을 합쳤을 때 60자 이내 한 문장이 되도록 하고 같은 말을 반복하지 마세요. coaching_directions는 화면에 표시하지 않는 보조 정보이므로 꼭 필요한 지원 하나만 작성하세요. coaching_questions는 담임이 학생에게 비공개로 실제 건넬 수 있는 개방형 질문 한 문장만 50자 이내로 작성하세요. avoid_actions와 possible_interpretations는 기본 화면에 표시하지 않는 검증용 정보이며 꼭 필요한 경우만 한 개 작성하세요. class_patterns는 인공지능이 여러 학생의 응답에서 공통으로 확인되는 우리 학급의 구체적인 모습만 최대 3개 작성하세요. pattern은 인원·영역·방향을 포함한 80자 이내 한 문장으로 쓰세요. 특정 학생의 응답이 흐름을 이해하는 데 꼭 필요하면 pattern이나 evidence에 학생-N을 최대 3명까지 표시하세요. evidence에는 핵심 수치나 익명 학생 근거를 최대 2개 넣고, teacher_check에는 교실 장면 하나와 확인할 행동 하나를 합친 60자 이내 한 문장만 쓰세요. 모든 evidence 문장은 반드시 [계산 결과], [학생 원문], [친구 관찰] 중 하나로 시작하고 추측은 evidence에 넣지 마세요. 내부 JSON 필드명이나 영문 변수명을 결과에 절대 복사하지 말고 교사가 이해할 수 있는 한국어 항목명으로 바꾸세요. 특히 peer, hurt, needsHelp, unresolved, monthly_changes, responsibility, received_average_delta 같은 문자열을 출력하지 마세요. 관계 평균이나 비율을 근거로 쓸 때는 해당 응답자 수 또는 응답 건수를 함께 쓰세요. 현재 입력에는 직접 경험·직접 목격·전해 들음의 구분 정보가 없으므로 이를 확정하지 말고 '학생이 작성한 서술'이라고 표현하세요. 학생을 진단·낙인·확정하지 말고 입력에 직접 있는 근거만 쓰세요. 이름은 입력의 학생-N 표기를 그대로 유지하세요. 폭력·자해·즉각적 도움 요청은 즉시 확인으로 우선 표시하세요. 결석·미제출은 부정 신호로 해석하지 마세요. 관계 점수만으로 고립이나 집단을 확정하지 마세요. 모든 자연어는 자연스러운 한국어 한 문장으로 작성하고 번호 목록을 사용하지 마세요. 영어 단어, 영어 문장, 영어 제목을 출력하지 마세요. 한국어 조사를 자연스럽게 사용하고 특히 '도움 요청가'가 아니라 '도움 요청이'라고 쓰세요.`;
    const classCoachingInstruction=' priority_students의 기본 화면은 담임 참고, 교실에서 살펴볼 점, 학생 코칭만 사용합니다. 같은 뜻을 세 항목에 반복하지 마세요. class_patterns는 우리 반 응답 흐름이며 학급 전체 응답의 인원·평균·변화를 중심으로 쓰세요. 흐름을 이해하는 데 꼭 필요한 학생만 학생-N으로 최대 3명까지 표시하세요. 특정 학생의 응답을 가리킬 때는 반드시 입력에 있는 학생-N을 그대로 쓰고, 식별 번호가 사라지는 "개별 학생", "한 학생", "일부 학생"이라는 표현으로 바꾸지 마세요. 여러 학생을 묶어 말할 때는 정확한 인원이나 응답 건수를 쓰세요. 관계망·자리·모둠·친구 집단 해석은 넣지 마세요. 영어 단어, 영어 문장, 영어 제목, 영어 우선순위 표기는 사용하지 마세요.';
    const sourceRefInstruction=' 각 주의 학생의 source_refs에는 입력의 source_refs 중 해당 근거를 직접 뒷받침하는 값만 원문 그대로 최대 4개 복사하세요. 새로운 ID나 경로를 만들지 마세요.';
    const brevityInstruction=' 전체 출력이 잘리지 않도록 각 배열 항목은 한 문장, 각 문장은 120자 이내로 간결하게 작성하세요.';
    const model='gpt-5.4-mini';
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(openAiTimeoutMs),headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,reasoning:{effort:'low'},instructions:prompt+classCoachingInstruction+sourceRefInstruction+brevityInstruction,input:JSON.stringify({response_count:evidence.length,responses:evidence}),max_output_tokens:5000,text:{format:{type:'json_schema',name:'class_support_analysis',strict:true,schema}}})});
    const result=await ai.json().catch(()=>null);
    if(!ai.ok){const requestId=ai.headers.get('x-request-id')||'',detail=text(result?.error?.message,500)||`OpenAI 응답 코드 ${ai.status}`;console.error('OpenAI API request failed',{status:ai.status,code:result?.error?.code||'',type:result?.error?.type||'',message:detail,requestId});await failAnalysis(detail,requestId);return json({error:`AI 분석 요청에 실패했습니다. ${detail}`,requestId},502)}
    if(result?.status==='incomplete'){const reason=result?.incomplete_details?.reason||'출력 한도';const message=`AI 분석 결과가 ${reason} 때문에 완성되지 않았습니다. 다시 시도해 주세요.`;await failAnalysis(message,ai.headers.get('x-request-id')||'');return json({error:message},502)}
    const outputText=(result?.output||[]).flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text;
    if(!outputText){const message='AI 분석 결과를 읽지 못했습니다.';await failAnalysis(message,ai.headers.get('x-request-id')||'');return json({error:message},502)}
    const allowedRefs=new Set(evidence.flatMap((row:any)=>row.source_refs||[])),analysis=localizeAnalysisValues(JSON.parse(outputText)),generatedAt=new Date().toISOString();(analysis.priority_students||[]).forEach((item:any)=>{item.source_refs=(item.source_refs||[]).filter((ref:any)=>allowedRefs.has(String(ref))) });
    await callRpc('teacher_complete_ai_analysis_auth',{p_class_id:classId,p_run_id:runId,p_result:analysis,p_model:model,p_response_count:evidence.length,p_request_id:ai.headers.get('x-request-id')||''});
    return json({analysis,meta:{runId,model,month,responseCount:evidence.length,generatedAt,cached:false,analysisVersion}});
  }catch(error){const timedOut=error instanceof DOMException&&error.name==='TimeoutError';const message=timedOut?'AI 응답 시간이 45초를 초과했습니다. 잠시 후 다시 시도해 주세요.':error instanceof Error?error.message:'서버 분석 중 오류가 발생했습니다.';if(runId&&failAnalysis)await failAnalysis(message);console.error('AI analysis failed',{runId,message});return json({error:message},timedOut?504:500)}
});
