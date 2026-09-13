const test=require('node:test'),assert=require('node:assert/strict');
const sources=[
 {id:'E1',month:'2026-09',field:'helpNow',inputKind:'선택형',value:'괜찮음',displayValue:'지금은 괜찮아요'},
 {id:'E2',month:'2026-09',field:'studentState.teacherWish',inputKind:'서술형',value:'격려해 주세요'},
 {id:'E3',month:'2026-08',field:'selfRatings.study',inputKind:'점수 선택과 서술형 이유',value:'5점 · 노력했어요'},
 {id:'E4',month:'2026-09',field:'selfRatings.study',inputKind:'점수 선택과 서술형 이유',value:'3점 · 어려웠어요'},
 {id:'E5',month:'2026-09',field:'selfRatings.listening',inputKind:'점수 선택과 서술형 이유',value:'5점 · 잘 들었어요'}
];
test('같은 월의 무관한 문항은 학습 자기평가 근거가 될 수 없다',async()=>{
 const {validateEvidenceMonths:check}=await import('../supabase/functions/student-coaching/coaching.mjs');
 assert.throws(()=>check('9월 학습 자기평가는 5점입니다.',['E1'],sources),/문항/);
});
test('선택형과 서술형을 함께 인용해도 선택을 적었다고 표현할 수 없다',async()=>{
 const {validateEvidenceMonths:check}=await import('../supabase/functions/student-coaching/coaching.mjs');
 assert.throws(()=>check('9월 도움 요청에 괜찮음이라고 적었습니다.',['E1','E2'],sources),/선택형/);
 assert.doesNotThrow(()=>check('9월 도움 요청에 지금은 괜찮아요를 선택했습니다. 선생님께 듣고 싶은 말로 격려해 주세요라고 적었습니다.',['E1','E2'],sources));
});
test('점수는 같은 월의 해당 문항과 일치해야 한다',async()=>{
 const {validateEvidenceMonths:check}=await import('../supabase/functions/student-coaching/coaching.mjs');
 assert.throws(()=>check('9월 학습 자기평가는 5점입니다.',['E3','E4','E5'],sources),/점수/);
 assert.doesNotThrow(()=>check('8월 학습 자기평가는 5점입니다. 9월 학습 자기평가는 3점입니다.',['E3','E4'],sources));
});
test('문항별·월별로 나누지 않은 점수 비교는 저장 전에 거부한다',async()=>{
 const {validateEvidenceMonths:check}=await import('../supabase/functions/student-coaching/coaching.mjs');
 assert.throws(()=>check('8월과 9월 학습 자기평가는 5점과 3점입니다.',['E3','E4'],sources),/월별/);
 assert.throws(()=>check('9월 학습 자기평가와 경청 자기평가는 3점과 5점입니다.',['E4','E5'],sources),/문항별/);
});
test('미래 대화 질문을 과거 사실 주장으로 오인하지 않는다',async()=>{
 const {validateEvidenceMonths:check}=await import('../supabase/functions/student-coaching/coaching.mjs');
 assert.doesNotThrow(()=>check('학생이 원하면 도움 요청 방법을 물어봅니다.',['E2'],sources));
});
