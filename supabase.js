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
async function teacherSignIn(email,password){const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.msg||result?.error_description||'로그인에 실패했습니다.');setTeacherSession(result);return result}
async function teacherSignOut(){const session=getTeacherSession();if(session?.access_token)await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}}).catch(()=>null);setTeacherSession(null)}
function expireTeacherSession(){setTeacherSession(null);window.dispatchEvent(new CustomEvent('teacher-session-expired'))}
async function teacherRpc(functionName,payload={}){const session=getTeacherSession();if(!session?.access_token)throw new Error('교사 로그인이 필요합니다.');const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>null);if(response.status===401){expireTeacherSession();throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.')}if(!response.ok)throw new Error(result?.message||'권한이 있는 학급인지 확인해 주세요.');return result}
async function teacherEdgeFunction(functionName,payload={}){const session=getTeacherSession();if(!session?.access_token)throw new Error('교사 로그인이 필요합니다.');const response=await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>null);if(response.status===401){expireTeacherSession();throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.')}if(!response.ok)throw new Error(result?.error||'서버 분석 요청에 실패했습니다.');return result}
