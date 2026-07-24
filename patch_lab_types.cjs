const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const newTypes = `
export type ScaleHandoffChainPhaseV2 = 'idle' | 'rendering' | 'deferred' | 'applying' | 'chaining' | 'completed' | 'cancelled' | 'error';

export interface DeferredScaleCommitV2 {
  deferredId: number;
  gestureSessionId: number;
  endEventId: number;
  transformRevisionAtEnd: number;
  previewScaleAtEnd: number;
  effectiveScaleAtEnd: number;
  createdAt: number;
  replacedCount: number;
}
`;

content = content.replace("export interface ScaleHandoffInfoV2 {", newTypes + "\nexport interface ScaleHandoffInfoV2 {");

const pendingTarget = `  targetRenderRequestId: number | null;
  targetFrontSwapped: boolean;
}`;
const pendingNew = `  targetRenderRequestId: number | null;
  targetFrontSwapped: boolean;
  chainId: number;
  commitIndex: number;
  sourceTransformRevision: number;
}`;
content = content.replace(pendingTarget, pendingNew);

const refsTarget = `  const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);
  const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);
  const visualBaseScale = pendingHandoffRef.current ? pendingHandoffRef.current.baseCssScale : cssScale;`;

const refsNew = `  const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);
  const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);
  const deferredIntentRef = useRef<DeferredScaleCommitV2 | null>(null);
  const deferredIdCounterRef = useRef(0);
  const chainIdCounterRef = useRef(0);
  const chainCommitIndexRef = useRef(0);
  
  // UI state for continuous handoff chain
  const [chainPhase, setChainPhase] = useState<ScaleHandoffChainPhaseV2>('idle');
  const [chainInfo, setChainInfo] = useState<{ chainId: number; commitIndex: number; deferred: DeferredScaleCommitV2 | null }>({ chainId: 0, commitIndex: 0, deferred: null });

  const visualBaseScale = pendingHandoffRef.current ? pendingHandoffRef.current.baseCssScale : cssScale;`;
content = content.replace(refsTarget, refsNew);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
