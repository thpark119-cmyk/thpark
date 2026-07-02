const fs = require('fs');
let content = fs.readFileSync('src/components/Metronome.tsx', 'utf8');
content = content.replace(
  /const updateDebugMsg = \(msg: string\) => \{/,
  `useEffect(() => { if (showDebug) { setDebugMsg(latestDebugMsgRef.current); } }, [showDebug]);\n  const updateDebugMsg = (msg: string) => {`
);
fs.writeFileSync('src/components/Metronome.tsx', content);
