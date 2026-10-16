const {test,expect}=require('@playwright/test');
test('자체 확인창 취소·포커스·사유 입력과 스타일',async({page})=>{
 let nativeDialogs=0;page.on('dialog',async dialog=>{nativeDialogs++;await dialog.dismiss();});
 await page.goto('./');
 const trigger=page.locator('#gateLoginButton');await trigger.focus();
 await page.evaluate(()=>{window.confirmResult=undefined;uiConfirm('<b>작업 확인</b>').then(value=>window.confirmResult=value);});
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog.locator('p')).toHaveText('<b>작업 확인</b>');await expect(dialog.locator('b')).toHaveCount(0);
 expect(await page.evaluate(()=>uiConfirm('중복 요청'))).toBe(false);
 await expect(dialog.getByRole('button',{name:'취소',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 expect(await page.evaluate(()=>window.confirmResult)).toBe(false);
 await page.evaluate(()=>{window.promptResult=undefined;uiPrompt('변경 사유').then(value=>window.promptResult=value);});
 const accept=dialog.getByRole('button',{name:'확인',exact:true});await expect(accept).toBeDisabled();
 await dialog.getByRole('textbox').fill('  검증 사유  ');await accept.click();
 expect(await page.evaluate(()=>window.promptResult)).toBe('검증 사유');expect(nativeDialogs).toBe(0);
 expect(await page.evaluate(()=>getComputedStyle(document.body).fontFamily)).toContain('Pretendard');
 await expect(trigger).toHaveCSS('white-space','nowrap');await expect(trigger).toHaveCSS('user-select','none');
});
