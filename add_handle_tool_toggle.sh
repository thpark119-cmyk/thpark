#!/bin/bash
sed -i '465a\
  const handleToolToggle = (tool: ScoreAnnotationTool) => {\
    setCurrentTool(previous => (previous === tool ? '"'"'none'"'"' : tool));\
  };\
' src/components/score-viewer/ScoreViewer.tsx
