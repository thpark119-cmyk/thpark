const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', 'utf8');

const logColorsStart = `                      <span className={r.status === 'APPLIED' ? 'text-green-400 font-bold' : r.status === 'RENDERED' ? 'text-yellow-400 font-bold' : r.status === 'ERROR' ? 'text-red-400 font-bold' : 'text-stone-400 font-bold'}>`;
const logColorsReplace = `                      <span className={
                        r.status === 'APPLIED' || r.status === 'CHAIN_COMPLETED' ? 'text-green-400 font-bold' :
                        r.status === 'RENDERED' || r.status === 'DEFERRED' ? 'text-yellow-400 font-bold' :
                        r.status === 'CHAINED_COMMIT' || r.status === 'ACTIVE_REBASED' ? 'text-blue-400 font-bold' :
                        r.status === 'DEFERRED_REPLACED' || r.status === 'COALESCED' ? 'text-purple-400 font-bold' :
                        r.status === 'ERROR' || r.status === 'CANCELLED' ? 'text-red-400 font-bold' : 'text-stone-400 font-bold'
                      }>`;

content = content.replace(logColorsStart, logColorsReplace);

fs.writeFileSync('src/components/score-viewer/v2/V2RendererLab.tsx', content);
