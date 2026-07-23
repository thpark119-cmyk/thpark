const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/      setIsTwoFingerGestureActive\(true\);\n      event\.preventDefault\(\);\n      event\.stopPropagation\(\);\n/m, `      setIsTwoFingerGestureActive(true);

      const viewport = scoreViewportRef.current;
      if (viewport) {
        for (const pointerId of touchPointersRef.current.keys()) {
          try {
            if (!viewport.hasPointerCapture(pointerId)) {
              viewport.setPointerCapture(pointerId);
            }
          } catch {}
        }
      }

      event.preventDefault();
      event.stopPropagation();\n`);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
