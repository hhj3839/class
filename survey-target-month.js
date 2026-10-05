(function(){
  const input=document.getElementById('surveyTargetMonth'),save=document.getElementById('saveSurveyTargetMonth'),auto=document.getElementById('autoSurveyTargetMonth'),status=document.getElementById('surveyTargetMonthStatus');
  let requestVersion=0;
  const currentMonth=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,7);
  const controls=enabled=>{input.disabled=save.disabled=auto.disabled=!enabled;};
  function show(value){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value?.month||''))throw new Error('설문 대상 월을 확인하지 못했습니다.');
    input.value=value.month;input.max=currentMonth();
    status.textContent=`현재 학생 설문: ${value.month.slice(0,4)}년 ${Number(value.month.slice(5))}월 · ${value.automatic?'이번 달 자동':'교사 지정 (직접 변경할 때까지 유지)'}`;
  }
  async function load(){
    const version=++requestVersion,classId=classSettings.classId;controls(false);input.value='';
    if(!getTeacherSession()||getTeacherSession().guest||!classId){status.textContent='교사 계정에서 설문 대상 월을 설정할 수 있습니다.';return;}
    try{const value=await teacherRpc('teacher_get_survey_month_auth',{p_class_id:classId});if(version!==requestVersion||classId!==classSettings.classId)return;show(value);controls(true);}
    catch(error){if(version===requestVersion)status.textContent=`대상 월 설정을 불러오지 못했습니다: ${error.message}`;}
  }
  async function persist(automatic){
    if(save.disabled)return;
    if(!automatic&&(!input.value||!input.checkValidity())){status.textContent='이번 달까지의 올바른 대상 월을 선택해 주세요.';return;}
    const classId=classSettings.classId,version=++requestVersion;controls(false);
    try{const value=await teacherRpc('teacher_set_survey_month_auth',{p_class_id:classId,p_month:automatic?null:input.value+'-01'});if(version!==requestVersion||classId!==classSettings.classId)return;show(value);showToast('설문 대상 월을 저장했습니다. 기존 응답의 월은 바뀌지 않습니다.');}
    catch(error){status.textContent=`대상 월 저장 실패: ${error.message}`;}
    finally{if(version===requestVersion&&getTeacherSession()&&!getTeacherSession().guest)controls(true);}
  }
  save.addEventListener('click',()=>persist(false));auto.addEventListener('click',()=>persist(true));
  document.addEventListener('class-ieum:data-updated',load);
})();
