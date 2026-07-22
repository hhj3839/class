const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const excluded=new Set(['.git','vendor','node_modules','tmp']);
const textExtensions=new Set(['.css','.html','.js','.json','.md','.mjs','.sql','.ts','.yml','.yaml']);

function repositoryFiles(directory='.'){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    if(excluded.has(entry.name))return[];
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())return repositoryFiles(file);
    return textExtensions.has(path.extname(entry.name).toLowerCase())?[file]:[];
  });
}

test('공개 저장소에 대표적인 비밀키 형식을 포함하지 않는다',()=>{
  const patterns=[
    ['OpenAI 비밀키',new RegExp(`sk-${'proj'}-[A-Za-z0-9_-]{16,}`)],
    ['GitHub 개인 토큰',new RegExp(`gh${'p'}_[A-Za-z0-9]{20,}`)],
    ['GitHub 세분화 토큰',new RegExp(`github_${'pat'}_[A-Za-z0-9_]{20,}`)],
    ['개인키',new RegExp(`BEGIN (?:RSA |EC |OPENSSH )?PRIVATE ${'KEY'}`)],
    ['Supabase service role 값',new RegExp(`SUPABASE_SERVICE_ROLE_KEY\\s*[:=]\\s*['\"]?[A-Za-z0-9._-]{20,}`,'i')]
  ];
  const findings=[];
  repositoryFiles().forEach(file=>{
    const source=fs.readFileSync(file,'utf8');
    patterns.forEach(([label,pattern])=>{if(pattern.test(source))findings.push(`${file}: ${label}`)});
  });
  assert.deepEqual(findings,[]);
});

test('민감한 운영 자료와 인증서 파일은 커밋 대상에서 제외한다',()=>{
  const ignore=fs.readFileSync('.gitignore','utf8');
  ['.env','*.pem','*.key','*.p12','*.pfx','*백업*.json','*학생자료*.json'].forEach(pattern=>assert.match(ignore,new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))));
});
