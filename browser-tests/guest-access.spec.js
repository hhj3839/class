const {test,expect}=require('@playwright/test');
for(const width of [360,1440])test(`가상 학급 진입과 종료 ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const requests=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*.supabase.co/**',async route=>{
  requests.push(route.request().url());const body=route.request().postDataJSON();let data=[];
  if(body.kind==='status')data={month:'2026-09',analysisRemaining:10,coachingRemaining:100};
  if(body.name==='teacher_get_my_classes')data=[{class_id:'demo-aa891ab949014621'}];
  if(body.name==='teacher_get_class_context_auth')data={classId:'demo-aa891ab949014621',schoolYear:2026,grade:5,classNumber:99,teacherName:'가상 학급',students:[{number:1,name:'가상학생',studentId:'11111111-1111-1111-1111-111111111111'}]};
  await route.fulfill({status:200,json:data});
 });
 await page.goto('./');await page.getByRole('button',{name:'가상 학급 둘러보기'}).click();
 await expect(page.locator('#teacherApp')).toBeVisible();await expect(page.locator('#guestBanner')).toContainText('10/10회');
 await expect(page.locator('[data-view="settings"]')).toBeHidden();
 expect(requests.every(url=>url.endsWith('/functions/v1/guest-lab'))).toBe(true);
 await page.locator('#authButton').click();await expect(page.locator('#authGate')).toBeVisible();await expect(page.locator('#teacherApp')).toBeHidden();expect(errors).toEqual([]);
});
test('체험 준비 실패는 로그인 우회 없이 안내',async({page})=>{
 await page.route('**/*.supabase.co/**',route=>route.fulfill({status:400,json:{error:'가상 학급 준비 중입니다.'}}));
 await page.goto('./');await page.locator('#gateGuestButton').click();await expect(page.locator('#guestError')).toContainText('준비 중');await expect(page.locator('#teacherApp')).toBeHidden();
});
