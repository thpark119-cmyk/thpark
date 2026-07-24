const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', 'utf8');

const endEventOld = `          hadPinch: sessionHadPinchRef.current,
          lastPinchViewportX,
          lastPinchViewportY,
          transform: { ...transformRef.current },`;
const endEventNew = `          hadPinch: sessionHadPinchRef.current,
          lastPinchViewportX,
          lastPinchViewportY,
          transformRevision: transformRevisionRef.current,
          transform: { ...transformRef.current },`;

content = content.replace(endEventOld, endEventNew);
fs.writeFileSync('src/components/score-viewer/v2/GestureViewportV2.tsx', content);
