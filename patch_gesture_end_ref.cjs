const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const refSearch = `  const lastAppliedGestureSessionIdRef = useRef<number | null>(null);`;
const refReplace = `  const lastAppliedGestureSessionIdRef = useRef<number | null>(null);
  const lastGestureEndEventRef = useRef<GestureEndEventV2 | null>(null);`;

content = content.replace(refSearch, refReplace);

const updateSearch = `    if (lastProcessedSessionIdRef.current === ev.sessionId) {`;
const updateReplace = `    lastGestureEndEventRef.current = ev;
    if (lastProcessedSessionIdRef.current === ev.sessionId) {`;

content = content.replace(updateSearch, updateReplace);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
