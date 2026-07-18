const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const divOriginal = `      <div 
        ref={scoreViewportRef}
        data-score-viewer-viewport
        className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch] pointer-events-auto select-none"
        style={{
          touchAction: currentTool === 'none' ? 'pan-x pan-y' : 'none',
        }}
      >`;

const divReplacement = `      <div 
        ref={scoreViewportRef}
        data-score-viewer-viewport
        onPointerDownCapture={handleScorePointerDownCapture}
        onPointerMoveCapture={handleScorePointerMoveCapture}
        onPointerUpCapture={handleScorePointerUpCapture}
        onPointerCancelCapture={handleScorePointerCancelCapture}
        className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch] pointer-events-auto select-none"
        style={{
          touchAction: 'none',
        }}
      >`;

content = content.replace(divOriginal, divReplacement);

const pdfOriginal = `        <PdfPageCanvas
          storagePath={file.storagePath}
          pageNumber={currentPage}
          onPageCountChange={setPageCount}
          strokes={currentPageStrokes}
          onStrokesChange={handleStrokesChange}
          currentTool={isAnnotationReady ? currentTool : 'none'}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          eraserRadius={eraserRadius}
          onDirtyChange={updateDirtyState}
          onPreviousPage={() => changePage(-1)}
          onNextPage={() => changePage(1)}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < pageCount}
          zoomScale={zoomScale}
        />`;

const pdfReplacement = `        <PdfPageCanvas
          storagePath={file.storagePath}
          pageNumber={currentPage}
          onPageCountChange={setPageCount}
          strokes={currentPageStrokes}
          onStrokesChange={handleStrokesChange}
          currentTool={isAnnotationReady ? currentTool : 'none'}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          eraserRadius={eraserRadius}
          onDirtyChange={updateDirtyState}
          onPreviousPage={() => changePage(-1)}
          onNextPage={() => changePage(1)}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < pageCount}
          zoomScale={zoomScale}
          isTwoFingerGestureActive={isTwoFingerGestureActive}
          touchGestureSessionId={touchGestureSessionId}
        />`;

content = content.replace(pdfOriginal, pdfReplacement);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('Patch 5 done');
