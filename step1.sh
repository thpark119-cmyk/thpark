#!/bin/bash
# Remove type TouchInputMode
sed -i '35,37d' src/components/score-viewer/ScoreViewer.tsx

# Remove state touchInputMode
sed -i '124d' src/components/score-viewer/ScoreViewer.tsx

# Remove touchModeButton
sed -i '770,791d' src/components/score-viewer/ScoreViewer.tsx
