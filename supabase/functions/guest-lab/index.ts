import {CLASS_ID,LAB_EMAIL,guestOperation,publicContext} from './policy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
// Owner tokens never leave this isolate. The public interface is an explicit allowlist,
// not a generic authenticated proxy. No password or refresh token is sent to the client.
let session:any=null,login:Promise<any>|null=null;
async function labToken(url:string,key:string){
  if(session&&session.until>Date.now())return session.token;
  if(!login)login=(async()=>{
    const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
    const linkResponse=await fetch(`${url}/auth/v1/admin/generate_link`,{method:'POST',headers,body:JSON.stringify({type:'magiclink',email:LAB_EMAIL})});
    const link=await linkResponse.json();
    if(!linkResponse.ok||(link.user?.email||link.email)?.toLowerCase()!==LAB_EMAIL||!link.hashed_token)throw new Error('체험 연결을 준비하지 못했습니다.');
    const response=await fetch(`${url}/auth/v1/verify`,{method:'POST',headers,body:JSON.stringify({type:'magiclink',token_hash:link.hashed_token})});
    const data=await response.json();
    if(!response.ok||!data.access_token||data.user?.email?.toLowerCase()!==LAB_EMAIL)throw new Error('체험 연결을 준비하지 못했습니다.');
    session={token:data.access_token,until:Date.now()+Math.min(Number(data.expires_in)||300,2700)*1000};
    return session.token;
  })().finally(()=>{login=null});
  return login;
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405);
  try{
    const raw=await request.text();if(raw.length>2048)return json({error:'요청이 너무 큽니다.'},413);
    const op=guestOperation(JSON.parse(raw));
    const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const quota=async(kind:string|null=null)=>{
      const response=await fetch(`${url}/rest/v1/rpc/guest_lab_quota`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_kind:kind})});
      const value=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(/한도/.test(value?.message||'')?value.message:'가상 학급 준비 중입니다. 관리자에게 설정을 확인해 주세요.');
      return value;
    };
    let usage=await quota(); // Fail closed until the migration and approved owner exist.
    if(op.kind==='status')return json(usage);
    if(op.kind==='classes')return json([{class_id:CLASS_ID}]);
    const token=await labToken(url,key);
    if(op.charge)usage=await quota(op.charge); // Atomic shared reservation; failures count too.
    const path=op.kind==='rpc'?`rest/v1/rpc/${op.name}`:`functions/v1/${op.name}`;
    const response=await fetch(`${url}/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(op.payload),signal:AbortSignal.timeout(60000)});
    const value=await response.json().catch(()=>null);
    if(!response.ok)return json({error:'체험 요청을 완료하지 못했습니다. 잠시 후 저장된 결과를 확인해 주세요.',guestUsage:usage},response.status);
    if(op.name==='teacher_get_class_context_auth')return json(publicContext(value));
    if(op.kind==='edge')return json({...value,...(op.name==='student-coaching'?{remaining:Math.min(Number(value.remaining)||0,usage.coachingRemaining)}:{}),guestUsage:usage});
    return json(value);
  }catch(error){
    const message=error instanceof Error?error.message:'';
    const safe=/가상 학급|체험 연결|분석 기준|학생을 확인|지원하지|게스트 전체/.test(message)?message:'체험 요청을 처리하지 못했습니다.';
    return json({error:safe},/한도/.test(safe)?429:400);
  }
});
