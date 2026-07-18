const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

const newStatesAndRefs = `
  const touchPointersRef = useRef<Map<number, ScoreTouchPoint>>(new Map());
  const singleTouchPanRef = useRef<ScoreSingleTouchPan | null>(null);
  const pinchSessionRef = useRef<ScorePinchSession | null>(null);
  const suppressTouchUntilReleaseRef = useRef(false);
  const pinchFrameRef = useRef<number | null>(null);
  const pendingPinchUpdateRef = useRef<{ zoomScale: number; midpointX: number; midpointY: number; } | null>(null);
  
  const zoomScaleRef = useRef(zoomScale);
  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  const [isTwoFingerGestureActive, setIsTwoFingerGestureActive] = useState(false);
  const [touchGestureSessionId, setTouchGestureSessionId] = useState(0);
`;

content = content.replace(
  '  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null);',
  '  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null);\n' + newStatesAndRefs
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('Patch 2 done');
