const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const reps = [
  { search: "const handleZoomOut = () => { gestureRef.current?.resetTransform(); manualIntervention(); setCssScale((p) => Math.max(0.5, p - 0.25)); };",
    replace: "const handleZoomOut = () => { cancelScaleHandoffChain('handleZoomOut'); manualIntervention(); setCssScale((p) => Math.max(0.5, p - 0.25)); };" },
  { search: "const handleZoomIn = () => { gestureRef.current?.resetTransform(); manualIntervention(); setCssScale((p) => Math.min(2.0, p + 0.25)); };",
    replace: "const handleZoomIn = () => { cancelScaleHandoffChain('handleZoomIn'); manualIntervention(); setCssScale((p) => Math.min(2.0, p + 0.25)); };" },
  { search: "const handleZoomReset = () => { gestureRef.current?.resetTransform(); manualIntervention(); setCssScale(1); };",
    replace: "const handleZoomReset = () => { cancelScaleHandoffChain('handleZoomReset'); manualIntervention(); setCssScale(1); };" },
  { search: "const handlePrevPage = () => { gestureRef.current?.resetTransform(); manualIntervention(); setPageNumber((p) => Math.max(1, p - 1)); };",
    replace: "const handlePrevPage = () => { cancelScaleHandoffChain('handlePrevPage'); manualIntervention(); setPageNumber((p) => Math.max(1, p - 1)); };" },
  { search: "const handleNextPage = () => { gestureRef.current?.resetTransform(); manualIntervention(); setPageNumber((p) => Math.min(numPages, p + 1)); };",
    replace: "const handleNextPage = () => { cancelScaleHandoffChain('handleNextPage'); manualIntervention(); setPageNumber((p) => Math.min(numPages, p + 1)); };" },
  { search: "const loadPreset = (preset: { docId: string; page: number; scale: number; outputScale: number }) => {",
    replace: "const loadPreset = (preset: { docId: string; page: number; scale: number; outputScale: number }) => { cancelScaleHandoffChain('loadPreset');" },
  { search: "const handleOutputScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {",
    replace: "const handleOutputScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => { cancelScaleHandoffChain('handleOutputScaleChange');" },
  { search: "const initStressTest = useCallback((mode: StressTestModeV2, page: number, scale: number) => {",
    replace: "const initStressTest = useCallback((mode: StressTestModeV2, page: number, scale: number) => { cancelScaleHandoffChain('initStressTest');" },
  { search: "const resetStats = () => {",
    replace: "const resetStats = () => { cancelScaleHandoffChain('resetStats');" }
];

reps.forEach(r => {
  content = content.replace(r.search, r.replace);
});

// also in unmount
const unmountSearch = `    return () => {
      engine.destroy();
    };
  }, [docId]);`;
const unmountReplace = `    return () => {
      cancelScaleHandoffChain('unmount');
      engine.destroy();
    };
  }, [docId, cancelScaleHandoffChain]);`;
content = content.replace(unmountSearch, unmountReplace);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
