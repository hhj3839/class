const {test,expect}=require('@playwright/test');
for(const width of [360,768,1440])test(`설문 실패 복구·제출 후 임시 저장 삭제 ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950});
  const errors=[],payloads=[];page.on('pageerror',error=>errors.push(error.message));let fail=true;
  await page.route('**/*.supabase.co/**',async route=>{
    const url=route.request().url();
    if(url.includes('get_roster_by_token'))return route.fulfill({json:[{number:1,name:'가상학생가'},{number:2,name:'가상학생나'}]});
    if(url.includes('submit_response_by_token')){payloads.push(route.request().postDataJSON());return route.fulfill(fail?{status:503,json:{message:'가상 연결 실패'}}:{json:true})}
    return route.fulfill({json:[]});
  });
  await page.goto('./student.html?join=mock-submission-test');
  await page.locator('#studentSelect').selectOption('1');await page.locator('#verifyStudent').click();
  await page.locator('#worryDetail').fill('가상 학생의 점검 응답');await page.locator('#selfSmile').click();await page.locator('#confirmAnswer').check();
  await page.locator('#submitSurvey').click();await expect(page.locator('#submitMessage')).toContainText('제출하지 못했습니다');
  const drafts=()=>page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('ieum-student-draft:')).length);
  await expect.poll(drafts).toBe(1);await expect(page.locator('#submitSurvey')).toBeEnabled();
  await page.reload();await page.locator('#studentSelect').selectOption('1');await page.locator('#verifyStudent').click();
  await expect(page.locator('#worryDetail')).toHaveValue('가상 학생의 점검 응답');await expect(page.locator('#selfSmile')).toHaveAttribute('aria-pressed','true');
  fail=false;await page.locator('#confirmAnswer').check();
  // Keep delayed saves pending while submitting, then exercise both lifecycle paths.
  await page.locator('#worryDetail').fill('가상 학생의 최종 응답');await page.locator('#submitSurvey').click();await expect(page.locator('#completeCard')).toBeVisible();
  expect(await drafts()).toBe(0);
  await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));document.dispatchEvent(new Event('visibilitychange'));saveDraft()});
  await page.waitForTimeout(650);expect(await drafts()).toBe(0);
  expect(payloads).toHaveLength(2);expect(payloads[0].p_payload.submissionId).toBe(payloads[1].p_payload.submissionId);
  await page.reload();await page.locator('#studentSelect').selectOption('1');await page.locator('#verifyStudent').click();
  await expect(page.locator('#worryDetail')).toHaveValue('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);expect(errors).toEqual([]);
});
