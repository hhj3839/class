import '../analyze-class/relationship-data.js';
import { redactStudentNames } from '../analyze-class/privacy.mjs';
import { buildEvidence, validateCard, schema, instructions, VERSION, MODEL } from './coaching.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
Deno.serve(async(request:Request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
  let runId:string|null=null,classId='',rpc:any;
  try{
    const authorization=request.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))return json({error:'교사 로그인이 필요합니다.'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const auth=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:authorization}}),user=await auth.json().catch(()=>null);
    if(!auth.ok||!user?.id)return json({error:'교사 로그인이 필요합니다.'},401);
    const body=await request.json().catch(()=>null),action=body?.action||'load';classId=body?.classId||'';
    if(!classId||typeof classId!=='string'||!/^[-\w]{36}$/.test(body?.studentId||'')||!['load','generate'].includes(action))return json({error:'학급과 학생을 확인해 주세요.'},400);
    rpc=async(name:string,payload:any)=>{const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anon,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.message||'담당 학급 권한을 확인해 주세요.');return data};
    const args={p_class_id:classId,p_student_id:body.studentId},context=await rpc('teacher_get_student_coaching_context_auth',args),evidence=buildEvidence(context,(globalThis as any).IeumRelationshipData);
    const existing=context.card;let stale=!!existing&&(existing.source_hash!==context.sourceHash||existing.result_json?.version!==VERSION);
    if(existing&&!stale){try{existing.result_json=validateCard(existing.result_json,evidence.sources)}catch{stale=true}}
    const responseView=(card:any,cached:boolean)=>({card:card&&!stale?{id:card.id,result:card.result_json,generatedAt:card.completed_at||card.created_at,model:card.model,basisMonth:card.basis_month}:null,stale,hasSavedCard:!!card,remaining:context.remaining,basisMonth:evidence.basisMonth,canGenerate:evidence.canGenerate,limited:evidence.limited,sources:evidence.sources,feedback:context.feedback||[],cached});
    if(action==='load')return json(responseView(existing,true));
    if(existing&&!stale&&!body.force)return json(responseView(existing,true));
    if(!evidence.canGenerate)return json({error:'코칭 근거가 될 응답이나 관찰 기록이 없습니다. 학생과 먼저 대화하고 자료를 남겨 주세요.'},422);
    const key=Deno.env.get('OPENAI_API_KEY');if(!key)return json({error:'서버 AI 키 설정이 필요합니다.'},503);
    runId=await rpc('teacher_begin_student_coaching_auth',{...args,p_source_hash:context.sourceHash,p_basis_month:evidence.basisMonth});
    const privacyRoster=[...context.roster,...(context.responses||[]).map((row:any)=>({number:row.student_number,name:row.student_name}))];
    const input={limited:evidence.limited,transferred:!!context.student.transferredOn,basis_month:evidence.basisMonth,evidence:evidence.sources.map((source:any)=>({id:source.id,type:source.type,month:source.month,question:source.label,text:source.value.slice(0,500)})),prior_feedback:(context.feedback||[]).map((row:any)=>({status:({not_tried:'아직 시도 전',helpful:'도움 됨',needs_change:'다른 방법 필요'} as any)[row.status],note:String(row.note||'').slice(0,500)}))};
    const redacted=JSON.stringify(redactStudentNames(input,privacyRoster)).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 비공개]').replace(/01[016789][- .]?\d{3,4}[- .]?\d{4}/g,'[연락처 비공개]');
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:MODEL,store:false,reasoning:{effort:'low'},instructions,input:redacted,max_output_tokens:5000,text:{format:{type:'json_schema',name:'student_coaching_card',strict:true,schema}}})});
    const result=await ai.json().catch(()=>null);
    if(!ai.ok)throw new Error(ai.status===429?'AI 사용량 또는 요청 한도에 도달했습니다. 잠시 후 확인해 주세요.':'AI 코칭 생성 요청에 실패했습니다.');
    if(result?.status!=='completed')throw new Error('AI 코칭 결과가 완성되지 않았습니다. 다시 시도해 주세요.');
    const output=result.output?.flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==='output_text')?.text;
    const card=validateCard(JSON.parse(output||'null'),evidence.sources);
    await rpc('teacher_finish_student_coaching_auth',{p_class_id:classId,p_card_id:runId,p_result:card,p_model:MODEL,p_success:true});
    const refreshed=await rpc('teacher_get_student_coaching_context_auth',args);
    if(refreshed.sourceHash!==context.sourceHash)return json({card:null,stale:true,hasSavedCard:true,remaining:refreshed.remaining,basisMonth:evidence.basisMonth,canGenerate:true,limited:evidence.limited,sources:[],feedback:[],cached:false});
    return json({card:{id:runId,result:card,generatedAt:refreshed.card?.completed_at,basisMonth:evidence.basisMonth,model:MODEL},stale:false,hasSavedCard:true,remaining:refreshed.remaining,basisMonth:evidence.basisMonth,canGenerate:true,limited:evidence.limited,sources:evidence.sources,feedback:refreshed.feedback||[],cached:false});
  }catch(error){
    if(runId&&rpc)await rpc('teacher_finish_student_coaching_auth',{p_class_id:classId,p_card_id:runId,p_result:{},p_model:MODEL,p_success:false}).catch(()=>null);
    const message=error instanceof Error?error.message:'학생 코칭 처리에 실패했습니다.';
    const display=/schema cache|Could not find.*function/i.test(message)?'학생 코칭 DB 설정이 아직 적용되지 않았습니다. 담당자에게 설정을 확인해 주세요.':/timeout/i.test(message)?'AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.':message;
    return json({error:display},/권한|학생을 찾/.test(message)?403:/한도|생성 중/.test(message)?429:500);
  }
});
