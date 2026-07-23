const fs = require('fs');

let scoreCode = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');
scoreCode = scoreCode.replace(/export const SCORE_TWO_FINGER_GESTURE_START_EVENT = 'mio-score-two-finger-gesture-start';\n/m, '');
fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', scoreCode);

let annoCode = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');
annoCode = annoCode.replace(/import \{ SCORE_TWO_FINGER_GESTURE_START_EVENT \} from '\.\/ScoreViewer';\n/m, '');
fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', annoCode);
