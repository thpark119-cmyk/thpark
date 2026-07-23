const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/AnnotationLayer.tsx', 'utf8');

code = code.replace(/  const activeAnnotationPointerIdRef = useRef<number \| null>\(null\);\n/m, `  const activeAnnotationPointerIdRef = useRef<number | null>(null);
  const lastReportedAnnotationReadyRef = useRef<{
    requestId: number;
    scale: number;
    width: number;
    height: number;
  } | null>(null);\n`);

fs.writeFileSync('src/components/score-viewer/AnnotationLayer.tsx', code);
