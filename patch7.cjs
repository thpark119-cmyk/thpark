const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/PdfPageCanvas.tsx', 'utf8');

const downOriginal = `  const handleViewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      currentTool !== 'none' ||
      zoomScale !== 1 ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      viewTapCandidateRef.current = null;
      return;
    }

    viewTapCandidateRef.current = {`;

const downReplacement = `  useEffect(() => {
    if (isTwoFingerGestureActive) {
      viewTapCandidateRef.current = null;
    }
  }, [isTwoFingerGestureActive]);

  const handleViewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      isTwoFingerGestureActive ||
      currentTool !== 'none' ||
      zoomScale !== 1 ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      viewTapCandidateRef.current = null;
      return;
    }

    viewTapCandidateRef.current = {`;

content = content.replace(downOriginal, downReplacement);

const upOriginal = `    if (
      candidate.moved ||
      distance >= VIEW_TAP_MOVE_THRESHOLD_PX ||
      duration > VIEW_TAP_MAX_DURATION_MS ||
      currentTool !== 'none' ||
      zoomScale !== 1
    ) {
      return;
    }`;

const upReplacement = `    if (
      isTwoFingerGestureActive ||
      candidate.moved ||
      distance >= VIEW_TAP_MOVE_THRESHOLD_PX ||
      duration > VIEW_TAP_MAX_DURATION_MS ||
      currentTool !== 'none' ||
      zoomScale !== 1
    ) {
      return;
    }`;

content = content.replace(upOriginal, upReplacement);

fs.writeFileSync('src/components/score-viewer/PdfPageCanvas.tsx', content, 'utf8');
console.log('Patch 7 done');
