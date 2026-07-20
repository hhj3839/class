const SUPABASE_URL='https://wxhcualawzwybsllrkqm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_BH9JYHTIGhj7lt6C0oA4RQ_1oKhnsOe';

async function supabaseRpc(functionName,payload){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(result?.message||'데이터베이스 요청에 실패했습니다.');
  return result;
}

const AUTH_SESSION_KEY='ieum-teacher-session';
function getTeacherSession(){try{return JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY)||'null')}catch(error){return null}}
function setTeacherSession(session){if(session)sessionStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(session));else sessionStorage.removeItem(AUTH_SESSION_KEY)}
function authErrorMessage(result,fallback){const raw=String(result?.message||result?.msg||result?.error_description||result?.error||'').trim(),code=String(result?.code||'');if(code==='user_already_exists'||/already registered|already been registered/i.test(raw))return '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.';if(code==='weak_password'||/password.*least|weak password/i.test(raw))return '비밀번호는 8자 이상으로 설정해 주세요.';if(/signup.*disabled|signups not allowed/i.test(raw))return '현재 Supabase에서 신규 회원가입이 꺼져 있습니다. Email provider 설정을 확인해 주세요.';if(code==='over_email_send_rate_limit'||/rate limit/i.test(raw))return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';if(/invalid.*email/i.test(raw))return '이메일 주소 형식을 확인해 주세요.';return raw||fallback}
async function teacherSignIn(email,password){const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(authErrorMessage(result,'로그인에 실패했습니다.'));setTeacherSession(result);return result}
async function teacherSignUp(email,password){const redirectUrl=new URL('.',location.href).href,response=await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(authErrorMessage(result,'회원가입에 실패했습니다.'));if(result?.access_token)setTeacherSession(result);return result}
async function teacherSignOut(){const session=getTeacherSession();if(session?.access_token)await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}}).catch(()=>null);setTeacherSession(null)}
function expireTeacherSession(){setTeacherSession(null);window.dispatchEvent(new CustomEvent('teacher-session-expired'))}
async function teacherRpc(functionName,payload={}){const session=getTeacherSession();if(!session?.access_token)throw new Error('교사 로그인이 필요합니다.');const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>null);if(response.status===401){expireTeacherSession();throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.')}if(!response.ok)throw new Error(result?.message||'권한이 있는 학급인지 확인해 주세요.');return result}
async function teacherEdgeFunction(functionName,payload={}){const session=getTeacherSession();if(!session?.access_token)throw new Error('교사 로그인이 필요합니다.');const response=await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>null);if(response.status===401){expireTeacherSession();throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.')}if(!response.ok)throw new Error(result?.error||'서버 분석 요청에 실패했습니다.');return result}
