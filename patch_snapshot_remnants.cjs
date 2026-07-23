const fs = require('fs');
let code = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

code = code.replace(/        const snapshot = activePinchSnapshotRef\.current;\n        if \(\n          snapshot &&\n          snapshot\.requestId !== null &&\n          snapshot\.requestId === expectedRequestId &&\n          snapshot\.requestedScale !== null &&\n          Math\.abs\(snapshot\.requestedScale - renderedZoomScale\) < 0\.005\n        \) \{\n          schedulePinchSnapshotRemoval\(snapshot\);\n        \}\n/g, '');

code = code.replace(/  }, \[getScorePageSurface, clearPinchPreviewStyle, schedulePinchSnapshotRemoval\]\);\n/g, '  }, [getScorePageSurface, clearPinchPreviewStyle]);\n');

code = code.replace(/    removePinchSnapshot\(\);\n/g, '');

code = code.replace(/  }, \[clearPinchPreviewStyle, removePinchSnapshot\]\);\n/g, '  }, [clearPinchPreviewStyle]);\n');

code = code.replace(/    const activeSnapshot = activePinchSnapshotRef\.current;\n    if \(activeSnapshot\) \{\n      removePinchSnapshot\(activeSnapshot\.generation\);\n    \}\n/g, '');

code = code.replace(/  }, \[file\?.id, file\?.storagePath, repertoireId, removePinchSnapshot\]\);\n/g, '  }, [file?.id, file?.storagePath, repertoireId]);\n');

code = code.replace(/  }, \[currentPage, removePinchSnapshot\]\);\n/g, '  }, [currentPage]);\n');

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', code);
