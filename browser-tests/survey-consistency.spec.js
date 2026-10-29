const {test,expect}=require('@playwright/test');
for(const width of [360,1440])test(`제출 집계·분석 제외·월 선택 동기화 ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});
 await page.clock.setFixedTime(new Date('2026-10-29T03:00:00Z'));
 const students=[1,2].map(number=>({number,name:`가상학생${number}`,studentId:`fixture-${number}`}));
 const rows=[
  {id:'sep-1',student_number:1,survey_month:'2026-09-01',submitted_at:'2026-09-01T01:00:00Z',payload_json:{}},
  {id:'sep-2',student_number:2,survey_month:'2026-09-01',submitted_at:'2026-09-01T01:00:00Z',analysis_excluded:true,payload_json:{}},
  {id:'oct-1',student_number:1,survey_month:'2026-10-01',submitted_at:'2026-10-01T01:00:00Z',payload_json:{}}
 ];
 await page.route('**/*.supabase.co/**',async route=>{
  const url=route.request().url(),request=route.request().postDataJSON()||{},guest=url.includes('/guest-lab');
  const name=guest?request.name:url.split('/').pop();let body=[];
  if(guest&&request.kind==='status')body={month:'2026-10',analysisRemaining:10,coachingRemaining:100};
  if(url.includes('/auth/v1/token'))body={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
  if(name==='teacher_get_my_classes')body=[{class_id:'fixture'}];
  if(name==='teacher_get_class_context_auth')body={classId:'fixture',teacherName:'가상 교사',schoolYear:2026,grade:3,classNumber:1,students};
  if(name==='teacher_get_responses_auth')body=guest?rows.slice(0,2):rows;
  if(name==='teacher_get_survey_month_auth')body={month:'2026-10',automatic:true};
  await route.fulfill({json:body});
 });
 async function navigate(view){if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();await page.locator(`[data-view="${view}"]`).click();}
 await page.goto('./');await page.locator('#gateGuestButton').click();
 await expect(page.locator('#surveyMonth')).toHaveValue('2026-09');
 await page.locator('#authButton').click();await page.locator('#gateLoginButton').click();
 await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-only');await page.locator('#authSubmitButton').click();
 await expect(page.locator('#teacherApp')).toBeVisible();
 await expect(page.locator('#analysisMonth option[value="2026-10"]')).toHaveCount(1);
 await navigate('survey');await page.locator('[data-survey-admin-tab="status"]').click();
 await expect(page.locator('#surveyMonth')).toHaveValue('2026-09');
 await expect(page.locator('#surveyParticipation')).toHaveText('2 / 2명');
 await expect(page.locator('#monthlySurveyAccordion summary').filter({hasText:'2026년 9월'})).toContainText('2/2명');
 await page.locator('#refreshResponses').click();
 await expect(page.locator('#surveyParticipation')).toHaveText('2 / 2명');
 await navigate('analysis');await page.locator('#analysisMonth').selectOption('2026-10');
 await navigate('survey');
 await expect(page.locator('#surveyMonth')).toHaveValue('2026-10');
 await expect(page.locator('#surveyParticipation')).toHaveText('1 / 2명');
 await page.locator('#surveyMonth').selectOption('2026-09');
 await expect(page.locator('#analysisMonth')).toHaveValue('2026-09');
 expect(await page.evaluate(()=>latestByStudent(allResponses,'2026-09').size)).toBe(1);
});
