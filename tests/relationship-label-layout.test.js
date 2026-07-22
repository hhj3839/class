const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');

test('관계 지도는 이름 라벨의 가로·세로 충돌을 반복해서 분리한다',()=>{
  assert.match(app,/function separateRelationshipPositions\(positions,width,height\)/);
  assert.match(app,/minX=132,minY=60/);
  assert.match(app,/pass<120/);
  assert.match(app,/overlapX<=0\|\|overlapY<=0/);
  assert.match(app,/separateRelationshipPositions\(positions,width,height\)/);
});

test('관계 지도 이름 상자는 충돌 간격보다 작고 캔버스 경계 안에 유지된다',()=>{
  assert.match(app,/paddingX=68,paddingY=34/);
  assert.match(app,/<rect x="-60" y="-22" width="120" height="44"/);
  assert.match(app,/Math\.max\(paddingX,Math\.min\(width-paddingX/);
  assert.match(app,/Math\.max\(paddingY,Math\.min\(height-paddingY/);
});
