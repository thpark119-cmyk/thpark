const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

content = content.replace(
  "    const handleVisibilityChange = () => {\n      if (document.visibilityState === 'hidden') {\n        resetTouchGestureState();",
  "    const handleVisibilityChange = () => {\n      if (window.document.visibilityState === 'hidden') {\n        resetTouchGestureState();"
);

content = content.replace(
  "    document.addEventListener('visibilitychange', handleVisibilityChange);",
  "    window.document.addEventListener('visibilitychange', handleVisibilityChange);"
);

content = content.replace(
  "      document.removeEventListener('visibilitychange', handleVisibilityChange);",
  "      window.document.removeEventListener('visibilitychange', handleVisibilityChange);"
);

content = content.replace(
  "    const handleVisibilityChange = () => {\n      if (document.visibilityState === 'hidden') {\n        void flushLatestAnnotations('visibility-hidden');",
  "    const handleVisibilityChange = () => {\n      if (window.document.visibilityState === 'hidden') {\n        void flushLatestAnnotations('visibility-hidden');"
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('patched');
