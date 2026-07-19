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
