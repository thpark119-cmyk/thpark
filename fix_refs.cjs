const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const target = `  const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);
  const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);`;
  
const replace = `  const pendingHandoffRef = useRef<PendingScaleHandoffV2 | null>(null);
  const [handoffResults, setHandoffResults] = useState<ScaleHandoffInfoV2[]>([]);
  
  const deferredIntentRef = useRef<DeferredScaleCommitV2 | null>(null);
  const deferredIdCounterRef = useRef(0);
  const chainIdCounterRef = useRef(0);
  const chainCommitIndexRef = useRef(0);
  const deferredReplacementCountRef = useRef(0);
  
  // UI state for continuous handoff chain
  const [chainPhase, setChainPhase] = useState<ScaleHandoffChainPhaseV2>('idle');
  const [chainInfo, setChainInfo] = useState<{ chainId: number; commitIndex: number; deferred: DeferredScaleCommitV2 | null }>({ chainId: 0, commitIndex: 0, deferred: null });`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
