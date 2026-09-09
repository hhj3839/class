const {test,expect}=require('@playwright/test');
for(const width of [360,1440])test(`전출·취소와 월별 집계 ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7);
  const before=new Date(`${month}-01T00:00:00Z`);before.setUTCMonth(before.getUTCMonth()-1);const previous=before.toISOString().slice(0,7);
  const students=[1,2].map(number=>({number,name:`가상학생${number}`,studentId:`fixture-${number}`,transferredOn:null}));let fail=false;
  await page.route('**/*.supabase.co/**',async route=>{
    const url=route.request().url();let body=[];
    if(url.includes('/auth/v1/token'))body={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
    if(url.includes('teacher_get_my_classes'))body=[{class_id:'fixture'}];
    if(url.includes('teacher_get_class_context_auth'))body={classId:'fixture',teacherName:'가상 교사',schoolYear:2026,grade:3,classNumber:1,students};
    if(url.includes('teacher_get_responses_auth'))body=[previous,month].map(period=>({id:period,student_id:'fixture-1',student_number:1,student_name:'가상학생1',survey_month:`${period}-01`,submitted_at:`${period}-01T00:00:00Z`,payload_json:{relationships:[]}}));
    if(url.includes('teacher_set_student_transfer_auth')){if(fail){await route.fulfill({status:403,json:{message:'담당 학급에 대한 권한이 없습니다.'}});return}const args=route.request().postDataJSON();expect(args.p_class_id).toBe('fixture');students.find(student=>student.studentId===args.p_student_id).transferredOn=args.p_transferred_on;body=true}
    await route.fulfill({status:200,json:body});
  });
  await page.goto('./');await page.locator('#gateLoginButton').click();await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-password');await page.locator('#authSubmitButton').click();await expect(page.locator('#teacherApp')).toBeVisible();
  async function navigate(view){if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();await page.locator(`[data-view="${view}"]`).click()}
  await navigate('settings');await page.locator('[data-transfer-student="1"]').click();await expect(page.locator('#studentTransferDialog')).toBeVisible();await page.locator('#confirmStudentTransfer').click();
  await expect(page.locator('#rosterCount')).toContainText('재학 1명 · 전출 1명');await expect(page.locator('[data-transfer-student="1"]')).toHaveText('전출 취소');
  await page.locator('.roster-panel').screenshot({path:testInfo.outputPath('transfer-roster.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await navigate('survey');await page.getByRole('tab',{name:'제출 현황',exact:true}).click();await expect(page.locator('#surveyParticipation')).toContainText('1 / 1명');await expect(page.locator('#studentGrid')).toContainText('가상학생2');
  await page.locator('#surveyMonth').selectOption(previous);await expect(page.locator('#surveyParticipation')).toContainText('1 / 2명');
  await navigate('settings');await page.locator('[data-transfer-student="1"]').click();await page.locator('#confirmStudentTransfer').click();await expect(page.locator('#rosterCount')).toContainText('재학 2명 · 전출 0명');
  fail=true;await page.locator('[data-transfer-student="1"]').click();await page.locator('#confirmStudentTransfer').click();await expect(page.locator('#studentTransferError')).toContainText('권한');await expect(page.locator('#rosterCount')).toContainText('재학 2명');expect(errors).toEqual([]);
});
