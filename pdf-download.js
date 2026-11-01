(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumPdfDownload = api;
})(globalThis, function () {
  function create({ document, getCanvasRenderer, getPdfConstructor }) {
    async function downloadPdfDocument(content, fileName) {
      const html2canvas = getCanvasRenderer(),
        jsPDF = getPdfConstructor();
      if (typeof html2canvas !== 'function' || !jsPDF)
        throw new Error(
          'PDF 구성 요소를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.',
        );
      const root = document.createElement('section');
      root.className = 'pdf-render-root';
      root.innerHTML = content;
      document.body.append(root);
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
          }),
          margin = 16,
          pageWidth = 210,
          pageHeight = 297,
          contentWidth = pageWidth - margin * 2,
          footerY = 289,
          maxY = footerY - 8,
          usableHeight = maxY - margin,
          blocks = [...root.children].flatMap((child) =>
            child.classList.contains('pdf-ai-section')
              ? [...child.querySelectorAll('.pdf-block')]
              : [child],
          );
        const canvasCache = new Map();
        const canvasFor = async block => {
          if (!canvasCache.has(block)) canvasCache.set(block, await html2canvas(block, {
            scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true,
          }));
          return canvasCache.get(block);
        };
        const heightOf = canvas => canvas.height * contentWidth / canvas.width;
        const isHeading = block => /^H[1-6]$/.test(block.tagName || '') || ['pdf-section-heading', 'pdf-comparison-heading', 'pdf-coaching-page-heading'].some(name => block.classList.contains(name));
        let y = margin;
        const newPage = () => {
            pdf.addPage();
            y = margin;
          },
          renderBlock = async (block) => {
            if (
              block.hasAttribute('data-pdf-page-start') &&
              y > margin &&
              (pdf.getNumberOfPages() === 1 || y > margin + usableHeight * 0.55)
            )
              newPage();
            const canvas = await canvasFor(block),
              imageWidth = contentWidth,
              imageHeight = (canvas.height * imageWidth) / canvas.width;
            const canSharePage = imageHeight > usableHeight * 0.4 &&
              y + imageHeight > maxY && maxY - y >= 30;
            if (imageHeight <= usableHeight && !canSharePage) {
              if (y + imageHeight > maxY) newPage();
              pdf.addImage(
                canvas.toDataURL('image/png'),
                'PNG',
                margin,
                y,
                imageWidth,
                imageHeight,
                undefined,
                'FAST',
              );
              y += imageHeight + 4;
              return;
            }
            const pixelsPerMm = canvas.width / imageWidth;
            // Keep text lines and normal-sized table rows intact. Use remaining
            // page space instead of abandoning the preceding section heading.
            const protectedRanges = [];
            if (document.createTreeWalker && block.getBoundingClientRect) {
              const rect = block.getBoundingClientRect(), scale = canvas.width / rect.width;
              const protect = box => {
                if (box.height > 0 && box.height * scale <= usableHeight * pixelsPerMm)
                  protectedRanges.push([(box.top - rect.top) * scale, (box.bottom - rect.top) * scale]);
              };
              const walker = document.createTreeWalker(block, 4);
              while (walker.nextNode()) {
                const range = document.createRange();
                range.selectNodeContents(walker.currentNode);
                for (const box of range.getClientRects()) protect(box);
              }
              for (const row of block.querySelectorAll('tr')) protect(row.getBoundingClientRect());
            }
            let offset = 0;
            while (offset < canvas.height) {
              const maxSlicePixels = Math.floor((maxY - y) * pixelsPerMm);
              let end = Math.min(canvas.height, offset + maxSlicePixels);
              let previous;
              do {
                previous = end;
                for (const [top, bottom] of protectedRanges)
                  if (top < end && bottom > end) end = Math.min(end, Math.floor(top));
              } while (end !== previous);
              if (end <= offset) {
                if (y > margin) { newPage(); continue; }
                throw new Error('PDF 내용을 페이지 안에 배치할 수 없습니다.');
              }
              const sliceHeight = end - offset,
                slice = document.createElement('canvas');
              slice.width = canvas.width;
              slice.height = sliceHeight;
              slice
                .getContext('2d')
                .drawImage(
                  canvas,
                  0,
                  offset,
                  canvas.width,
                  sliceHeight,
                  0,
                  0,
                  canvas.width,
                  sliceHeight,
                );
              const sliceMm = sliceHeight / pixelsPerMm;
              pdf.addImage(
                slice.toDataURL('image/png'),
                'PNG',
                margin,
                y,
                imageWidth,
                sliceMm,
                undefined,
                'FAST',
              );
              y += sliceMm + 4;
              offset = end;
              if (offset < canvas.height) newPage();
            }
          };
        for (let index = 0; index < blocks.length; index++) {
          const block = blocks[index];
          if (isHeading(block) && index + 1 < blocks.length) {
            let groupHeight = heightOf(await canvasFor(block));
            for (let next = index + 1; next < blocks.length; next++) {
              const nextHeight = heightOf(await canvasFor(blocks[next]));
              groupHeight += 4 + (nextHeight > usableHeight * 0.4 ? 30 : nextHeight);
              if (!isHeading(blocks[next])) break;
            }
            if (groupHeight <= usableHeight && y + groupHeight > maxY && y > margin) newPage();
          }
          await renderBlock(block);
          canvasCache.delete(block);
        }
        const total = pdf.getNumberOfPages();
        for (let number = 1; number <= total; number++) {
          pdf.setPage(number);
          pdf.setDrawColor(205, 214, 218);
          pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
          pdf.setFontSize(9);
          pdf.setTextColor(95, 110, 120);
          pdf.text(`${number} / ${total}`, pageWidth - margin, footerY, {
            align: 'right',
          });
        }
        pdf.save(`${fileName.replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
      } finally {
        root.remove();
      }
    }
    return { downloadPdfDocument };
  }
  return { create };
});
