const {test,expect}=require('@playwright/test');
for(const width of [360,1440])test(`교육용 디자인 전체 화면 ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*.supabase.co/**',async route=>{
  const url=route.request().url();let body=[];
  if(url.includes('/auth/v1/token'))body={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
  if(url.includes('teacher_get_my_classes'))body=[{class_id:'fixture'}];
  if(url.includes('teacher_get_class_context_auth'))body={classId:'fixture',schoolYear:2026,grade:3,classNumber:1,teacherName:'가상 교사',students:[{number:1,name:'가상학생',student_id:'a'}]};
  if(url.includes('teacher_get_survey_month_auth'))body={month:'2026-09',automatic:false};
  if(url.includes('get_survey_month_by_token'))body={month:'2026-09'};
  if(url.includes('get_roster_by_token'))body=[{number:1,name:'가상학생'},{number:2,name:'가상친구'}];
  await route.fulfill({json:body});
 });
 await page.goto('./');await expect(page.locator('#authGate')).toBeVisible();
 await expect(page.locator('link[href*="design-system.css"]')).toHaveCount(1);
 await expect(page.locator('link[href*="education-ui.css"],link[href*="minimal-ui.css"],link[href*="student-overview-pastel.css"]')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('login.png'),fullPage:true});
 await page.locator('#gateLoginButton').click();await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-password');await page.locator('#authSubmitButton').click();
 await expect(page.locator('#teacherApp')).toBeVisible();
 for(const view of ['home','survey','analysis','student-detail','relations','settings']){
  if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();
  await page.locator(`[data-view="${view}"]`).click();await expect(page.locator(`#view-${view}`)).toBeVisible();
  await page.mouse.move(width-5,990);
  await expect(page.locator(`#view-${view} .page-intro`)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(view==='home'){
   await expect(page.locator('.class-trend-empty')).toBeVisible();
   expect((await page.locator('#classTrendChart').boundingBox()).height).toBeLessThan(100);
   await expect(page.locator('#classTrendInsight')).toBeHidden();
   expect((await page.locator('.home-priority-card').first().boundingBox()).height).toBeLessThan(150);
   await expect(page.locator('#runAiAnalysis')).toHaveText('저장 결과 조회');
   // The empty-state CSS must stop applying as soon as populated chart content appears.
   await page.evaluate(()=>document.querySelector('#classTrendChart').innerHTML='<div class="chart-line"><span>자료</span></div>');
   expect((await page.locator('#classTrendChart').boundingBox()).height).toBeGreaterThanOrEqual(190);
   await expect(page.locator('#classTrendInsight')).toBeVisible();
   await page.evaluate(()=>renderClassTrend());
  }
  await page.screenshot({path:info.outputPath(`${view}.png`),fullPage:true});
 }
 await page.goto('./student.html?join=design-fixture');await page.locator('#studentSelect').selectOption('1');await page.locator('#verifyStudent').click();
 await expect(page.locator('#surveyFormTitle')).toContainText('2026년 9월');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:info.outputPath('student-survey.png'),fullPage:true});expect(errors).toEqual([]);
});
