const fs = require('fs');

let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

const interfaces = `
interface ViewTapCandidate {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startedAt: number;
  moved: boolean;
}

const VIEW_TAP_MOVE_THRESHOLD_PX = 12;
const VIEW_TAP_MAX_DURATION_MS = 500;
const PAGE_TURN_EDGE_RATIO = 0.35;
`;

content = content.replace('interface PdfPageCanvasProps {', interfaces + '\ninterface PdfPageCanvasProps {');

const newHandlers = `
  const viewTapCandidateRef = useRef<ViewTapCandidate | null>(null);

  const handleViewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      currentTool !== 'none' ||
      zoomScale !== 1 ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      viewTapCandidateRef.current = null;
      return;
    }

    viewTapCandidateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startedAt: window.performance.now(),
      moved: false,
    };
  };

  const handleViewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const candidate = viewTapCandidateRef.current;
    if (!candidate || candidate.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - candidate.startClientX;
    const deltaY = event.clientY - candidate.startClientY;

    if (Math.hypot(deltaX, deltaY) >= VIEW_TAP_MOVE_THRESHOLD_PX) {
      candidate.moved = true;
    }
  };

  const handleViewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const candidate = viewTapCandidateRef.current;
    viewTapCandidateRef.current = null;

    if (!candidate || candidate.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - candidate.startClientX;
    const deltaY = event.clientY - candidate.startClientY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = window.performance.now() - candidate.startedAt;

    if (
      candidate.moved ||
      distance >= VIEW_TAP_MOVE_THRESHOLD_PX ||
      duration > VIEW_TAP_MAX_DURATION_MS ||
      currentTool !== 'none' ||
      zoomScale !== 1
    ) {
      return;
    }

    const wrapper = pageWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const relativeX = event.clientX - rect.left;
    const horizontalRatio = relativeX / rect.width;

    if (horizontalRatio <= PAGE_TURN_EDGE_RATIO) {
      if (canGoPrevious) {
        onPreviousPage();
      }
      return;
    }

    if (horizontalRatio >= 1 - PAGE_TURN_EDGE_RATIO) {
      if (canGoNext) {
        onNextPage();
      }
    }
  };

  const clearViewTapCandidate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (viewTapCandidateRef.current?.pointerId === event.pointerId) {
      viewTapCandidateRef.current = null;
    }
  };
`;

content = content.replace('const [pageDisplaySize, setPageDisplaySize] = useState<PageDisplaySize>({ width: 0, height: 0 });', 'const [pageDisplaySize, setPageDisplaySize] = useState<PageDisplaySize>({ width: 0, height: 0 });\n' + newHandlers);

const divTarget = `              <div 
                ref={pageWrapperRef}
                className="relative max-w-none mx-auto shadow-xl bg-white"
                style={{
                  width: renderedPageWidth >= 40 ? \`\${renderedPageWidth}px\` : undefined,
                }}
              >`;

const divReplacement = `              <div 
                ref={pageWrapperRef}
                className="relative max-w-none mx-auto shadow-xl bg-white"
                onPointerDown={handleViewPointerDown}
                onPointerMove={handleViewPointerMove}
                onPointerUp={handleViewPointerUp}
                onPointerCancel={clearViewTapCandidate}
                onLostPointerCapture={clearViewTapCandidate}
                style={{
                  width: renderedPageWidth >= 40 ? \`\${renderedPageWidth}px\` : undefined,
                  touchAction: currentTool === 'none' ? 'pan-x pan-y' : undefined,
                }}
              >`;

content = content.replace(divTarget, divReplacement);

const pageTurnButtons = `                {isPageRendered && !downloadError && !documentError && !pageError && currentTool === 'none' && zoomScale === 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="이전 페이지"
                      title="이전 페이지"
                      data-page-turn-zone="previous"
                      disabled={!canGoPrevious}
                      onClick={event => {
                        event.stopPropagation();
                        if (!canGoPrevious) {
                          return;
                        }
                        onPreviousPage();
                      }}
                      className="absolute inset-y-0 left-0 z-10 w-[35%] border-0 bg-transparent p-0 touch-manipulation select-none cursor-w-resize disabled:pointer-events-none disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                    />
                    <button
                      type="button"
                      aria-label="다음 페이지"
                      title="다음 페이지"
                      data-page-turn-zone="next"
                      disabled={!canGoNext}
                      onClick={event => {
                        event.stopPropagation();
                        if (!canGoNext) {
                          return;
                        }
                        onNextPage();
                      }}
                      className="absolute inset-y-0 right-0 z-10 w-[35%] border-0 bg-transparent p-0 touch-manipulation select-none cursor-e-resize disabled:pointer-events-none disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                    />
                  </>
                )}`;

content = content.replace(pageTurnButtons, '');

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
console.log('done');
