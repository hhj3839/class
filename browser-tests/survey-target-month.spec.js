const {test,expect}=require('@playwright/test');
for(const width of [360,1440])test(`교사 대상 월 저장과 자동 모드 ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:950});await page.clock.setFixedTime(new Date('2026-10-05T03:00:00Z'));
 let setting={month:'2026-10',automatic:true};const writes=[];
 await page.route('**/*.supabase.co/**',async route=>{
  const url=route.request().url();let body=[];
  if(url.includes('/auth/v1/token'))body={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
  if(url.includes('teacher_get_my_classes'))body=[{class_id:'fixture'}];
  if(url.includes('teacher_get_class_context_auth'))body={classId:'fixture',schoolYear:2026,grade:3,classNumber:1,teacherName:'가상 교사',students:[]};
  if(url.includes('teacher_get_survey_month_auth'))body=setting;
  if(url.includes('teacher_set_survey_month_auth')){const payload=route.request().postDataJSON();writes.push(payload);setting={month:payload.p_month?.slice(0,7)||'2026-10',automatic:payload.p_month===null};body=setting;}
  await route.fulfill({json:body});
 });
 await page.goto('./');await page.locator('#gateLoginButton').click();await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-only');await page.locator('#authSubmitButton').click();
 await expect(page.locator('#teacherApp')).toBeVisible();
 if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();
 await page.locator('[data-view="survey"]').click();
 await expect(page.locator('#surveyTargetMonth')).toBeEnabled();
 await page.locator('#surveyTargetMonth').fill('2026-09');await page.locator('#saveSurveyTargetMonth').click();
 await expect(page.locator('#surveyTargetMonthStatus')).toContainText('2026년 9월');
 await expect(page.locator('#surveyTargetMonthStatus')).toContainText('교사 지정');
 expect(writes[0]).toEqual({p_class_id:'fixture',p_month:'2026-09-01'});
 await page.locator('.survey-month-settings').screenshot({path:info.outputPath('survey-month.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.locator('#autoSurveyTargetMonth').click();await expect(page.locator('#surveyTargetMonthStatus')).toContainText('이번 달 자동');expect(writes[1].p_month).toBeNull();
});
