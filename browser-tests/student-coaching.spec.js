const {test,expect}=require('@playwright/test');
for(const width of [360,768,1440])test(`학생 코칭 생성·근거·적용 결과 ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:950});const errors=[];page.on('pageerror',error=>errors.push(error.message));const dialogs=[];page.on('dialog',dialog=>{dialogs.push(dialog.message());dialog.accept()});
  const id='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',students=[{number:1,name:'가상학생가',studentId:id},{number:2,name:'가상학생나',studentId:otherId}];let card=null,feedback=[],generated=0,loads=0,externalUsage=0,safetyPriority=false;
  const item=text=>({text,refs:['E1']}),result={summary:item('발표가 편해지는 상황을 살펴보세요.'),strengths:[],needs:[item('말하기가 어려운 장면을 먼저 확인하세요.')],question:item('어떤 상황에서 이야기하기가 편하니?'),actions:[{title:'말하기 어려운 때를 이야기하면',steps:['학생이 실제로 말한 상황을 짧게 되짚어 맞는지 확인합니다.','조금 편하게 말했던 때에는 무엇이 달랐니?'],refs:['E1']}],check_after:'선택할 때: 해 보고 싶은 게 있니? 지금 정하지 않아도 괜찮아.\n실제로 해 본 뒤: 해 보니 너에게 어땠어? 그대로 하거나 바꾸고 싶은 게 있니?',limitations:['성격이나 원인을 단정하지 않습니다.'],version:'2026.09.12-gentle-reflection-v5'};
  await page.route('**/*.supabase.co/**',async route=>{const url=route.request().url();expect(url).not.toMatch(/teacher_(?:get|save)_observations?_auth/);const body=route.request().postDataJSON()||{};let response=[];
    if(url.includes('/auth/v1/token'))response={access_token:'test-only',refresh_token:'test-only',expires_in:3600,user:{id:'fixture',email:'fixture@example.invalid'}};
    if(url.includes('teacher_get_my_classes'))response=[{class_id:'fixture'}];
    if(url.includes('teacher_get_class_context_auth'))response={classId:'fixture',teacherName:'가상 교사',schoolYear:2026,grade:3,classNumber:1,students};
    if(url.includes('teacher_get_responses_auth'))response=[{id:'source-1',student_id:id,student_number:1,student_name:'가상학생가',survey_month:'2026-09-01',submitted_at:'2026-09-02T00:00:00Z',payload_json:{studentState:{worryDetail:'모둠에서 말하기 어려워요.'}}}];
    if(url.includes('/functions/v1/student-coaching')){if(body.action==='generate'){generated++;card={id:'card-1',result,generatedAt:'2026-09-09T00:00:00Z',basisMonth:'2026-09',model:'gpt-5.6-terra'}}else loads++;response={safetyPriority,previousGuidance:body.action==='load'&&!!card,card:body.studentId===id?card:null,remaining:100-generated-externalUsage,quotaMonth:'2026-09',quotaCheckedAt:Date.now(),stale:false,canGenerate:body.studentId===id,limited:true,basisMonth:'2026-09',sources:[{id:'E1',label:'학교생활 고민',month:'2026-09',type:'학생 응답',value:'모둠에서 말하기 어려워요.'}],feedback};}
    if(url.includes('teacher_record_student_coaching_feedback_auth')){feedback=[{card_id:body.p_card_id,status:body.p_status,note:body.p_note,created_at:'2026-09-09T01:00:00Z'}];response=true}
    if(url.includes('teacher_delete_student_coaching_auth')){card=null;feedback=[];response=true}
    await route.fulfill({status:200,json:response});
  });
  await page.goto('./');await expect(page.locator('#observationDialog,#view-observations,#saveObservation')).toHaveCount(0);await page.locator('#gateLoginButton').click();await page.locator('#authEmail').fill('fixture@example.invalid');await page.locator('#authPassword').fill('fixture-password');await page.locator('#authSubmitButton').click();await expect(page.locator('#teacherApp')).toBeVisible();
  if(await page.locator('#menuButton').isVisible())await page.locator('#menuButton').click();await page.locator('[data-view="student-detail"]').click();await expect(page.locator('#studentTabCoaching')).toBeDisabled();await page.locator('#studentDetailSelect').selectOption('1');await page.locator('#studentTabCoaching').click();
  await expect(page.locator('[data-coaching-generate]')).toBeEnabled();expect(generated).toBe(0);expect(loads).toBe(1);await expect(page.locator('[data-coaching-generate]')).toHaveText('AI 새 분석');await expect(page.locator('.coaching-ai-head [data-coaching-reload]')).toHaveText('저장된 결과 불러오기');await expect(page.locator('#studentCoachingContent')).toContainText('100 / 100회');await page.locator('[data-coaching-generate]').click();await expect(page.locator('.coaching-summary')).toContainText('발표가 편해지는');expect(generated).toBe(1);expect(dialogs).toEqual([]);await expect(page.locator('#studentCoachingContent')).toContainText('99 / 100회');await page.locator('.coaching-ai-head [data-coaching-reload]').click();await expect.poll(()=>loads).toBe(2);expect(generated).toBe(1);await expect(page.locator('#studentCoachingContent')).toContainText('이전 대화 지침으로 생성된 카드');
  await expect(page.locator('.coaching-info')).not.toHaveAttribute('open','');await expect(page.locator('.coaching-analysis')).not.toHaveAttribute('open','');await expect(page.locator('.coaching-feedback')).not.toHaveAttribute('open','');await expect(page.locator('.coaching-question')).toContainText('대화를 여는 질문');await page.locator('.coaching-summary .coaching-refs > summary').click();await expect(page.locator('.coaching-summary [data-coaching-source]')).toContainText('학교생활 고민');await page.locator('[data-coaching-source]').first().click();await expect(page.locator('#studentCoachingSource')).toContainText('모둠에서 말하기 어려워요.');await page.locator('#studentCoachingEvidence [data-close]').click();
  await page.locator('.coaching-feedback > summary').click();await page.locator('#studentCoachingOutcome').selectOption('helpful');await page.locator('#studentCoachingNote').fill('짝과 연습한 뒤 자신의 생각을 이야기함.');await page.locator('[data-coaching-feedback]').click();await expect(page.locator('#studentCoachingOutcome')).toHaveValue('helpful');await expect(page.locator('#studentCoachingNote')).toHaveValue('짝과 연습한 뒤 자신의 생각을 이야기함.');
  await expect(page.locator('.coaching-last-analysis')).toHaveText('마지막 분석 2026. 09. 09. 09:00:00 · 2026년 9월 자료 기준 · 저장 결과 · gpt-5.6-terra');
  const metaBounds=await page.locator('.coaching-last-analysis').boundingBox();expect(metaBounds.x+metaBounds.width).toBeLessThanOrEqual(width+1);
  const grid=await page.locator('.coaching-actions-grid').boundingBox(),single=await page.locator('.coaching-action').boundingBox();expect(Math.abs(grid.width-single.width)).toBeLessThan(2);await expect(page.locator('.coaching-dialogue-help')).toContainText('정하지 않아도 괜찮습니다');
  await expect(page.locator('.coaching-followup')).toContainText('대화 마무리');await expect(page.locator('.coaching-followup>p')).toHaveCSS('white-space','pre-line');await expect(page.locator('.coaching-followup>p')).toContainText('실제로 해 본 뒤:');
  if(width===1440){
    await page.evaluate(()=>{allResponses.push({student_number:1,survey_month:'2026-06-01',submitted_at:'2026-06-02',payload_json:{studentState:{worryDetail:'발표가 걱정돼요.'},helpNow:'이야기하고 싶어요.'}},{student_number:2,survey_month:'2026-06-01',submitted_at:'2026-06-02',payload_json:{relationships:[{targetNumber:1,score:3}]}},{student_number:2,survey_month:'2026-09-01',submitted_at:'2026-09-02',payload_json:{relationships:[{targetNumber:1,score:4}]}})});
    const callsBefore=generated;
    await page.evaluate(()=>{window.__pdfOriginal=downloadPdfDocument;downloadPdfDocument=async(content,name)=>{window.__pdfContent=content;await window.__pdfOriginal(content,name)}});
    const download=page.waitForEvent('download');await page.locator('#printStudentReport').click();const file=await download;
    await file.saveAs(testInfo.outputPath('student-coaching.pdf'));
    const content=await page.evaluate(()=>window.__pdfContent);
    expect(content).toContain('학생 한눈에 보기');expect(content).toContain('학생 코칭');expect(content).toContain('모둠에서 말하기 어려워요.');expect(content).toContain('함께 탐색할 주제');expect(content).not.toContain('교사 관찰');expect(content).not.toContain('교사의 적용 결과');expect(content).not.toContain('짝과 연습한 뒤 자신의 생각을 이야기함.');expect(content).not.toContain('최근 달과 이전 누적 기록');expect(generated).toBe(callsBefore);
    await expect(page.locator('.pdf-render-root')).toHaveCount(0);
    // 긴 학생 원문과 세 조건부 대화에서도 실제 PDF 다운로드를 검증합니다.
    const originalActions=result.actions;
    result.actions=[{title:'어려움을 이야기하면',steps:['학생이 실제로 말한 상황을 되짚어 맞는지 확인합니다. '.repeat(5),'조금 나아진다면 어떤 모습일까?'],refs:['E1']},{title:'방법을 찾고 싶어 하면',steps:['조금 편했던 때에는 무엇이 달랐니? '.repeat(5),'그중 다시 해 보고 싶은 방법이 있니?'],refs:['E1']},{title:'말하고 싶지 않으면',steps:['지금 정하지 않아도 괜찮아. 이야기하고 싶을 때 알려 줘.'],refs:['E1']}];
    result.question.text='최근 수업과 친구 관계에서 선생님이 알아주었으면 하는 장면을 들려줄 수 있니? '.repeat(5);
    feedback[0].note='짝과 연습한 뒤 자신의 생각을 이야기함. '.repeat(30);
    await page.evaluate(()=>{allResponses.filter(row=>row.student_number===1).forEach(row=>{row.payload_json.studentState={worryDetail:'모둠 활동에서 말할 차례를 기다리다가 생각을 말하지 못해 아쉬웠어요. '.repeat(20)};row.payload_json.helpNow='친구에게 내 생각을 전할 수 있도록 선생님과 이야기하고 싶어요. '.repeat(20)})});
    const longDownload=page.waitForEvent('download');await page.locator('#printStudentReport').click();await(await longDownload).saveAs(testInfo.outputPath('student-coaching-long.pdf'));
    expect(generated).toBe(callsBefore);await expect(page.locator('.pdf-render-root')).toHaveCount(0);result.actions=originalActions;
  }
  await page.locator('#studentTabSummary').click();await page.locator('#studentTabCoaching').click();expect(generated).toBe(1);
  await expect(page.locator('.coaching-summary>p')).toHaveCSS('font-size','15px');
  await expect(page.locator('.coaching-question>blockquote')).toHaveCSS('font-size',width<600?'18px':'19px');
  await expect(page.locator('.coaching-question>blockquote')).toHaveCSS('font-weight','600');
  await expect(page.locator('.coaching-action li').first()).toHaveCSS('color','rgb(98, 91, 112)');
  await expect(page.locator('.coaching-spoken').first()).toHaveCSS('font-weight','600');
  await expect(page.locator('.coaching-spoken').first()).toContainText('조금 편하게 말했던 때');
  await expect(page.locator('.coaching-action-section')).toHaveCSS('margin-top','16px');
  await page.locator('#studentPanelCoaching').screenshot({path:testInfo.outputPath('student-coaching-card.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  safetyPriority=true;
  await page.locator('.coaching-ai-head [data-coaching-reload]').click();await expect(page.locator('.coaching-dialogue-help')).toContainText('안전 확인은 먼저 진행');
  expect(generated).toBe(1);safetyPriority=false;
  await page.locator('.coaching-ai-head [data-coaching-reload]').click();await expect(page.locator('.coaching-dialogue-help')).toContainText('정하지 않아도 괜찮습니다');
  externalUsage=4;
  await page.locator('#studentDetailSelect').selectOption('2');await expect(page.locator('#studentCoachingContent')).toContainText('코칭을 만들 근거가 부족');await expect(page.locator('[data-coaching-generate]')).toBeDisabled();await expect(page.locator('#studentCoachingContent')).not.toContainText('발표가 편해지는');
  await page.locator('#studentDetailSelect').selectOption('1');await expect(page.locator('.coaching-summary')).toBeVisible();await expect(page.locator('#studentCoachingContent')).toContainText('95 / 100회');await expect(page.locator('[data-coaching-generate]')).toBeEnabled();await page.locator('.coaching-more > summary').click();await page.locator('[data-coaching-delete]').click();await expect(page.locator('.coaching-summary')).toHaveCount(0);expect(generated).toBe(1);expect(dialogs).toHaveLength(1);expect(dialogs[0]).toContain('삭제할까요');expect(errors).toEqual([]);
});
