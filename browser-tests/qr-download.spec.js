const {test, expect} = require('@playwright/test');
const fs = require('node:fs');

for (const width of [360, 768, 1440]) test(`QR 다운로드 PNG 형식과 픽셀 보존 ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 950});
  await page.route('**/*.supabase.co/**', route => route.fulfill({json: []}));
  await page.goto('./');
  // Render a synthetic class without touching production authentication or data.
  await page.evaluate(() => {
    setTeacherSession({access_token: 'fixture-only', expires_in: 3600, user: {id: 'fixture'}});
    classSettings = {...classSettings, grade: 3, classNumber: 1, participationToken: 'fixture-qr'};
    renderAuthState(); renderParticipationLink();
  });
  if (await page.locator('#menuButton').isVisible()) await page.locator('#menuButton').click();
  await page.locator('[data-view="survey"]').click();
  await expect(page.locator('#participationQr img')).toBeVisible();
  await expect.poll(() => page.locator('#participationQr img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadQr').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('우리반이음-3-1-참여QR.png');
  const bytes = fs.readFileSync(await download.path());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const unchanged = await page.evaluate(async data => {
    const original = document.querySelector('#participationQr img');
    const saved = new Image(); saved.src = data; await saved.decode();
    if (saved.naturalWidth !== original.naturalWidth || saved.naturalHeight !== original.naturalHeight) return false;
    function pixels(image) {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const before = pixels(original), after = pixels(saved);
    return before.every((value, index) => value === after[index]);
  }, `data:image/png;base64,${bytes.toString('base64')}`);
  expect(unchanged).toBe(true);
  expect(await page.locator('#copyLink').getAttribute('data-link')).toContain('student.html?join=fixture-qr');
});
