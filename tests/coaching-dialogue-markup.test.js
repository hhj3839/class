const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({document:{addEventListener(){}},aiTeacherDisplayText:String,escapeHTML:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')});
vm.runInContext(fs.readFileSync('student-coaching.js','utf8'),ctx);
test('따옴표 대화만 강조하고 교사 설명과 원문을 보존한다',()=>{const html=ctx.coachingDialogueMarkup('학생의 말을 듣고 “어떻게 느꼈니?”라고 묻습니다.');assert.equal(html,'학생의 말을 듣고 <strong class="coaching-spoken">“어떻게 느꼈니?”</strong>라고 묻습니다.');assert.equal(ctx.coachingDialogueMarkup('학생이 말할 때까지 기다립니다.'),'학생이 말할 때까지 기다립니다.')});
test('독립 질문을 강조하고 불완전한 인용은 그대로 둔다',()=>{assert.match(ctx.coachingDialogueMarkup('어떤 방법이 좋겠니?'),/^<strong/);assert.equal(ctx.coachingDialogueMarkup('학생이 “생각해 볼게요라고 말합니다.'),'학생이 “생각해 볼게요라고 말합니다.')});
test('강조 여부와 관계없이 HTML 실행 문자를 이스케이프한다',()=>{for(const value of ['“<img src=x onerror=alert(1)>”','<script>위험</script>']){const html=ctx.coachingDialogueMarkup(value);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;'))}});
