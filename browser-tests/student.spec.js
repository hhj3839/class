const {test,expect}=require('@playwright/test');
for(const width of [360,768,1440])test(`학생 탐색과 한 줄 배치 ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*.supabase.co/**',async route=>{
    const url=route.request().url();let body=[];
    if(url.includes('/auth/v1/token'))body={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
    if(url.includes('teacher_get_my_classes'))body=[{class_id:'fixture'}];
    if(url.includes('teacher_get_class_context_auth'))body={classId:'fixture',schoolYear:2026,grade:3,classNumber:1,teacherName:'가상 교사',students:[{number:1,name:'테스트가',student_id:'a'},{number:2,name:'테스트나',student_id:'b'}]};
    await route.fulfill({status:200,json:body});
  });
  await page.goto('./');
  await expect(page.locator('#teacherApp')).toBeHidden();
  await expect(page.getByText('테스트가',{exact:true})).toHaveCount(0);
  await page.locator('#gateLoginButton').click();
  await page.locator('#authEmail').fill('fixture@example.invalid');
  await page.locator('#authPassword').fill('fixture-only-password');
  await page.locator('#authSubmitButton').click();
  await expect(page.locator('#teacherApp')).toBeVisible();
  if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();
  await page.locator('[data-view="student-detail"]').click();
  await expect(page.locator('#studentTabSummary')).toBeDisabled();
  await page.locator('#studentDetailSelect').selectOption('1');
  await page.locator('#studentTabTrend').click();
  await expect(page.locator('#studentPanelTrend')).toBeVisible();
  await expect(page.locator('.student-year-point')).toHaveCount(12);
  await page.locator('#nextStudent').click();
  await expect(page.locator('#studentDetailSelect')).toHaveValue('2');
  await expect(page.locator('#studentPanelTrend')).toBeVisible();
  const geometry=await page.locator('.student-toolbar-actions').evaluate(el=>{
    const boxes=[...el.children].map(child=>child.getBoundingClientRect());
    return {centers:boxes.map(b=>b.y+b.height/2),right:Math.max(...boxes.map(b=>b.right)),width:innerWidth};
  });
  expect(Math.max(...geometry.centers)-Math.min(...geometry.centers)).toBeLessThan(3);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width);
  await page.locator('#studentTabResponses').click();
  await expect(page.locator('#studentPanelResponses')).toBeVisible();
  expect(errors).toEqual([]);
});
