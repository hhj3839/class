const {test,expect}=require('@playwright/test');
for(const width of [360,768,1440])test(`학생 코칭 생성·근거·적용 결과 ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:950});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',students=[{number:1,name:'가상학생가',studentId:id},{number:2,name:'가상학생나',studentId:otherId}];let card=null,feedback=[],generated=0,loads=0;
  const item=text=>({text,refs:['E1']}),result={summary:item('발표가 편해지는 상황을 살펴보세요.'),strengths:[],needs:[item('말하기가 어려운 장면을 먼저 확인하세요.')],question:item('어떤 상황에서 이야기하기가 편하니?'),actions:[{title:'짝과 먼저 연습하기',steps:['생각을 적고 짝에게 설명할 시간을 주세요.'],refs:['E1']}],check_after:'말하기가 조금 더 편해졌는지 물어보세요.',limitations:['성격이나 원인을 단정하지 않습니다.'],version:'2026.09.09-student-coaching-v1'};
  await page.route('**/*.supabase.co/**',async route=>{const url=route.request().url(),body=route.request().postDataJSON()||{};let response=[];
    if(url.includes('/auth/v1/token'))response={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
    if(url.includes('teacher_get_my_classes'))response=[{class_id:'fixture'}];
    if(url.includes('teacher_get_class_context_auth'))response={classId:'fixture',teacherName:'가상 교사',schoolYear:2026,grade:3,classNumber:1,students};
    if(url.includes('teacher_get_responses_auth'))response=[{id:'source-1',student_id:id,student_number:1,student_name:'가상학생가',survey_month:'2026-09-01',submitted_at:'2026-09-02T00:00:00Z',payload_json:{studentState:{worryDetail:'모둠에서 말하기 어려워요.'}}}];
    if(url.includes('/functions/v1/student-coaching')){if(body.action==='generate'){generated++;card={id:'card-1',result,generatedAt:'2026-09-09T00:00:00Z',basisMonth:'2026-09',model:'gpt-5.6-terra'}}else loads++;response={card:body.studentId===id?card:null,remaining:10-generated,stale:false,canGenerate:body.studentId===id,limited:true,basisMonth:'2026-09',sources:[{id:'E1',label:'학교생활 고민',month:'2026-09',type:'학생 응답',value:'모둠에서 말하기 어려워요.'}],feedback};}
    if(url.includes('teacher_record_student_coaching_feedback_auth')){feedback=[{card_id:body.p_card_id,status:body.p_status,note:body.p_note,created_at:'2026-09-09T01:00:00Z'}];response=true}
    if(url.includes('teacher_delete_student_coaching_auth')){card=null;feedback=[];response=true}
    await route.fulfill({status:200,json:response});
  });
  await page.goto('./');await page.locator('#gateLoginButton').click();await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-password');await page.locator('#authSubmitButton').click();await expect(page.locator('#teacherApp')).toBeVisible();
  if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();await page.locator('[data-view="student-detail"]').click();await expect(page.locator('#studentTabCoaching')).toBeDisabled();await page.locator('#studentDetailSelect').selectOption('1');await page.locator('#studentTabCoaching').click();
  await expect(page.locator('[data-coaching-generate]')).toBeEnabled();expect(generated).toBe(0);expect(loads).toBe(1);await page.locator('[data-coaching-generate]').click();await expect(page.locator('.coaching-summary')).toContainText('발표가 편해지는');expect(generated).toBe(1);
  await page.locator('[data-coaching-source]').first().click();await expect(page.locator('#studentCoachingSource')).toContainText('모둠에서 말하기 어려워요.');await page.locator('#studentCoachingEvidence [data-close]').click();
  await page.locator('#studentCoachingOutcome').selectOption('helpful');await page.locator('#studentCoachingNote').fill('짝과 연습한 뒤 자신의 생각을 이야기함.');await page.locator('[data-coaching-feedback]').click();await expect(page.locator('#studentCoachingOutcome')).toHaveValue('helpful');await expect(page.locator('#studentCoachingNote')).toHaveValue('짝과 연습한 뒤 자신의 생각을 이야기함.');
  await page.locator('#studentTabSummary').click();await page.locator('#studentTabCoaching').click();expect(generated).toBe(1);
  await page.locator('#studentPanelCoaching').screenshot({path:testInfo.outputPath('student-coaching-card.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#studentDetailSelect').selectOption('2');await expect(page.locator('#studentCoachingContent')).toContainText('코칭을 만들 근거가 부족');await expect(page.locator('[data-coaching-generate]')).toBeDisabled();await expect(page.locator('#studentCoachingContent')).not.toContainText('발표가 편해지는');
  await page.locator('#studentDetailSelect').selectOption('1');await expect(page.locator('.coaching-summary')).toBeVisible();await page.locator('[data-coaching-delete]').click();await expect(page.locator('.coaching-summary')).toHaveCount(0);expect(generated).toBe(1);expect(errors).toEqual([]);
});
