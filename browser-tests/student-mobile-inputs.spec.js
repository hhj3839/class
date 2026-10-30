const {test,expect}=require('@playwright/test');

for(const width of [375,768,1440])test(`자기평가 직접 선택·미선택 복구·입력 크기 ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const writes=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*.supabase.co/**',async route=>{
    const url=route.request().url();
    if(url.includes('get_survey_month_by_token'))return route.fulfill({json:{month:'2026-10'}});
    if(url.includes('get_roster_by_token'))return route.fulfill({json:[{number:1,name:'가상가'},{number:2,name:'가상나'}]});
    if(url.includes('submit_response_by_token')){writes.push(route.request().postDataJSON());return route.fulfill({json:true});}
    return route.fulfill({json:[]});
  });
  async function start(){await page.locator('#studentSelect').selectOption('1');await page.locator('#verifyStudent').click();}
  await page.goto('./student.html?join=mock-mobile-inputs');await start();
  await expect(page.locator('#selfRatings input:checked')).toHaveCount(0);
  await expect(page.getByRole('radiogroup')).toHaveCount(5);
  await expect(page.getByRole('textbox',{name:'공부를 열심히 했습니다. 선택 이유',exact:true})).toBeVisible();
  await page.locator('#confirmAnswer').check();await page.locator('#submitSurvey').click();
  expect(writes).toHaveLength(0);
  await expect(page.locator('input[name="rating_study"]').first()).toBeFocused();
  await page.locator('#reason_study').fill('아직 점수 선택 전');
  const readDraft=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key=>key.startsWith('ieum-student-draft:')))||'null'));
  await expect.poll(async()=> (await readDraft())?.payload.selfRatings.study.reason).toBe('아직 점수 선택 전');
  expect(Object.values((await readDraft()).payload.selfRatings).map(row=>row.score)).toEqual([null,null,null,null,null]);
  await page.locator('input[name="rating_study"][value="5"]').check();
  await expect.poll(async()=> (await readDraft())?.payload.selfRatings.study.score).toBe(5);
  await page.reload();await start();
  await expect(page.locator('#reason_study')).toHaveValue('아직 점수 선택 전');
  await expect(page.locator('input[name="rating_study"][value="5"]')).toBeChecked();
  await expect(page.locator('#selfRatings input:checked')).toHaveCount(1);
  await page.locator('#confirmAnswer').check();await page.locator('#submitSurvey').click();expect(writes).toHaveLength(0);
  for(const key of ['listening','respect','manners','responsibility'])await page.locator(`input[name="rating_${key}"][value="4"]`).check();
  await expect(page.locator('.rating-reason').first()).toHaveCSS('font-size','16px');
  await expect(page.locator('[data-relation-student]').first()).toHaveCSS('font-size','16px');
  expect((await page.locator('.submit-area .check-field').boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#submitSurvey').click();await expect(page.locator('#completeCard')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(Object.values(writes[0].p_payload.selfRatings).map(row=>row.score)).toEqual([5,4,4,4,4]);
  expect(errors).toEqual([]);
});
