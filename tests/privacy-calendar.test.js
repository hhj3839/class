const test=require('node:test');
const assert=require('node:assert/strict');
const {calendarMonths,academicYearMonths,observationMonthState}=require('../student-calendar.js');

test('학년도는 3월부터 다음 해 2월까지 12개월을 고정 표시한다',()=>{
  assert.deepEqual(academicYearMonths(2026),['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
  assert.equal(academicYearMonths(2023).at(-1),'2024-02');assert.throws(()=>academicYearMonths('bad'));
});
test('달력은 응답 유무와 무관하게 연속 12개월이며 연도를 넘긴다',()=>{
  const months=calendarMonths('2026-09');
  assert.equal(months.length,12);assert.equal(months[0],'2025-10');assert.equal(months.at(-1),'2026-09');assert.ok(months.includes('2026-06'));
});
test('예정일이 아니라 응답 기준 월에 실제 확인 상태를 표시한다',()=>{
  const student={number:1,studentId:'a'};
  const rows=[{studentId:'a',studentNumber:1,surveyMonth:'2026-06',date:'2026-09-10',status:'todo'},{studentId:'b',studentNumber:1,surveyMonth:'2026-06',status:'done'}];
  assert.equal(observationMonthState(rows,student,'2026-06'),'확인 예정');
  assert.equal(observationMonthState(rows,student,'2026-09'),'');
  rows[0].status='done';assert.equal(observationMonthState(rows,student,'2026-06'),'확인 완료');
});
test('서술 이름 치환은 긴 이름 우선이며 근거 참조와 입력을 보존한다',async()=>{
  const {redactStudentNames}=await import('../supabase/functions/analyze-class/privacy.mjs');
  const source={worry:'가나다가 나다와 이야기했습니다.',nested:{reason:'나다'},source_refs:['ref|worry'],response_id:'ref'};
  const result=redactStudentNames(source,[{name:'나다',number:1},{name:'가나다',number:2}]);
  assert.equal(result.worry,'학생-2가 학생-1와 이야기했습니다.');assert.equal(result.nested.reason,'학생-1');assert.deepEqual(result.source_refs,source.source_refs);assert.equal(source.nested.reason,'나다');
});
