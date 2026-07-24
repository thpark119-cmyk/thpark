const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const statusStart = `  status: 'COMMIT' | 'RENDERED' | 'APPLIED' | 'SKIPPED' | 'CANCELLED' | 'ERROR';`;
const statusReplace = `  status: 'COMMIT' | 'RENDERED' | 'APPLIED' | 'SKIPPED' | 'CANCELLED' | 'ERROR' | 'DEFERRED' | 'DEFERRED_REPLACED' | 'CHAINED_COMMIT' | 'ACTIVE_REBASED' | 'COALESCED' | 'CHAIN_COMPLETED';`;

content = content.replace(statusStart, statusReplace);
fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
