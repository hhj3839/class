// Preview state is memory-only. It is not a teacher credential and cannot authenticate
// against teacher RPCs. The gateway independently enforces every allowed operation.
let guestActive=false;
const teacherSessionOriginal=getTeacherSession,teacherRpcOriginal=teacherRpc,teacherEdgeOriginal=teacherEdgeFunction,teacherSignOutOriginal=teacherSignOut;
getTeacherSession=function(){return guestActive?{guest:true,user:{email:'가상 학급 · 게스트'}}:teacherSessionOriginal()};
function renderGuestUsage(usage){
  if(!usage)return;
  const label=document.getElementById('guestUsage');
  if(label)label.textContent=`${usage.month} · 전체 게스트 공용 잔여: 학급·관계 AI ${usage.analysisRemaining}/10회 · 학생 코칭 ${usage.coachingRemaining}/100회`;
}
async function guestRequest(kind,name,payload={}){
  const response=await fetch(`${SUPABASE_URL}/functions/v1/guest-lab`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({kind,name,payload})});
  const data=await response.json().catch(()=>null);renderGuestUsage(data?.guestUsage);
  if(!response.ok)throw new Error(data?.error||'가상 학급에 연결하지 못했습니다.');
  return data;
}
teacherRpc=async function(name,payload={}){
  if(!guestActive)return teacherRpcOriginal(name,payload);
  if(['teacher_get_audit_logs_auth','teacher_get_retention_policy_auth'].includes(name))return [];
  if(['teacher_get_pilot_readiness_auth','teacher_get_pilot_metrics_auth'].includes(name))return {};
  if(name==='teacher_roll_demo_months_forward_auth')return false;
  return guestRequest('rpc',name,payload);
};
teacherEdgeFunction=async function(name,payload={}){return guestActive?guestRequest('edge',name,payload):teacherEdgeOriginal(name,payload)};
teacherSignOut=async function(){if(!guestActive)return teacherSignOutOriginal();guestActive=false;document.body.classList.remove('guest-mode');document.getElementById('guestBanner').hidden=true};
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('teacherMain').insertAdjacentHTML('afterbegin','<aside class="guest-banner" id="guestBanner" hidden><strong>가상 학급 체험 · 실제 학생 자료가 아닙니다.</strong><span>자료 수정·삭제·설문 제출은 제한됩니다. AI 새 생성은 외부 API 비용과 공용 횟수를 사용하며 실패도 포함됩니다. 코칭은 실험실 계정의 남은 한도도 함께 적용됩니다.</span><span id="guestUsage"></span></aside>');
  const button=document.getElementById('gateGuestButton'),error=document.getElementById('guestError');
  button.addEventListener('click',async()=>{
    button.disabled=true;button.textContent='가상 학급 연결 중…';error.hidden=true;
    try{
      const usage=await guestRequest('status');
      guestActive=true;document.body.classList.add('guest-mode');document.getElementById('guestBanner').hidden=false;renderGuestUsage(usage);
      await bootstrapTeacherApp();
      document.querySelector('[data-view="home"]').click();
      document.querySelector('[data-survey-admin-tab="status"]').click();
    }catch(reason){guestActive=false;document.body.classList.remove('guest-mode');document.getElementById('guestBanner').hidden=true;clearSensitiveState();renderAuthState();error.textContent=reason.message;error.hidden=false}
    finally{button.disabled=false;button.textContent='가상 학급 둘러보기'}
  });
});
