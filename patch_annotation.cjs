const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

code = code.replace(/  const canvasRef = useRef<HTMLCanvasElement>\(null\);\n  const \[currentStroke, setCurrentStroke\] = useState<ScoreAnnotationStroke \| null>\(null\);\n  const activeAnnotationPointerIdRef = useRef<number \| null>\(null\);\n/m, '');

code = code.replace(/  const cancelActiveAnnotationSession = useCallback\(\(\) => \{/m, `  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStroke, setCurrentStroke] = useState<ScoreAnnotationStroke | null>(null);
  const activeAnnotationPointerIdRef = useRef<number | null>(null);

  const cancelActiveAnnotationSession = useCallback(() => {`);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
