const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(`    const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
    if (firstTwo) {
      const activeSnapshot = activePinchSnapshotRef.current;
      if (activeSnapshot) {
        if (
          currentPageRef.current === activeSnapshot.pageNumber &&
          file?.id === activeSnapshot.fileId &&
          file?.storagePath === activeSnapshot.storagePath &&
          isPinchSnapshotReplacementReady(activeSnapshot)
        ) {
          removePinchSnapshot(activeSnapshot.generation);
        } else {
          event.preventDefault();
          event.stopPropagation();
          touchPointersRef.current.clear();
          singleTouchPanRef.current = null;
          suppressTouchUntilReleaseRef.current = true;
          return;
        }
      }

      const [first, second] = firstTwo;`, `    const activeSnapshot = activePinchSnapshotRef.current;
    if (activeSnapshot) {
      removePinchSnapshot(activeSnapshot.generation);
    }

    const firstTwo = getFirstTwoTouchPoints(touchPointersRef.current);
    if (firstTwo) {
      const [first, second] = firstTwo;`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
