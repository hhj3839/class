const test = require('node:test');
const assert = require('node:assert/strict');
const {create} = require('../pdf-download.js');

function setup({height = 100, fail = false} = {}) {
  const result = {pages: 1, images: [], footers: [], removed: false};
  const block = {classList: {contains: () => false}, hasAttribute: () => false};
  const root = {children: [block], remove: () => {result.removed = true;}};
  const document = {
    fonts: {ready: Promise.resolve()}, body: {append() {}},
    createElement: tag => tag === 'section' ? root : {
      getContext: () => ({drawImage() {}}), toDataURL: () => 'data:image/png;base64,test'
    }
  };
  class Pdf {
    constructor(options) {result.options = options;}
    addPage() {result.pages++;}
    addImage(...args) {result.images.push(args);}
    getNumberOfPages() {return result.pages;}
    setPage() {} setDrawColor() {} line() {} setFontSize() {} setTextColor() {}
    text(value) {result.footers.push(value);}
    save(name) {result.name = name;}
  }
  const api = create({document, getPdfConstructor: () => Pdf, getCanvasRenderer: () => async () => {
    if (fail) throw new Error('render failure');
    return {width: 178, height, toDataURL: () => 'data:image/png;base64,test'};
  }});
  return {api, result};
}

test('PDF 엔진은 A4·여백·페이지 번호·파일명 정리를 유지한다', async () => {
  const {api, result} = setup();
  await api.downloadPdfDocument('<p>가상 학생</p>', '학생/보고서');
  assert.equal(result.options.format, 'a4');
  assert.equal(result.images[0][2], 16);
  assert.deepEqual(result.footers, ['1 / 1']);
  assert.equal(result.name, '학생-보고서.pdf');
  assert.equal(result.removed, true);
});

test('긴 PDF 블록은 여러 페이지로 나누고 각 페이지에 번호를 붙인다', async () => {
  const {api, result} = setup({height: 800});
  await api.downloadPdfDocument('<p>긴 가상 자료</p>', '긴 보고서');
  assert.equal(result.pages, 4);
  assert.equal(result.images.length, 4);
  assert.deepEqual(result.footers, ['1 / 4', '2 / 4', '3 / 4', '4 / 4']);
  assert.equal(result.removed, true);
});

test('PDF 렌더링 실패에도 임시 화면을 제거하고 오류를 전달한다', async () => {
  const {api, result} = setup({fail: true});
  await assert.rejects(api.downloadPdfDocument('<p>자료</p>', '보고서'), /render failure/);
  assert.equal(result.removed, true);
  assert.equal(result.name, undefined);
});

test('PDF 라이브러리 누락은 DOM 생성 전에 보고한다', async () => {
  const api = create({document: {createElement() {throw Error('DOM must not change');}}, getCanvasRenderer: () => undefined, getPdfConstructor: () => undefined});
  await assert.rejects(api.downloadPdfDocument('', '보고서'), /PDF 구성 요소/);
});
