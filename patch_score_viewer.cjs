const fs = require('fs');
let content = fs.readFileSync('src/components/score-viewer/ScoreViewer.tsx', 'utf8');

content = content.replace(
  'className="fixed inset-0 z-50 flex flex-col bg-stone-900 pointer-events-none"',
  'className="fixed inset-0 z-50 flex flex-col bg-stone-900 pointer-events-auto select-none"'
);

content = content.replace(
  '      <div className="relative z-40 h-12 md:h-14 bg-stone-800 border-b border-white/10 flex items-center justify-between px-2 md:px-4 shrink-0 min-w-0 safe-top">\n        <div className="flex items-center gap-2 md:gap-4 min-w-0">\n          <button onClick={handleClose} disabled={isClosing} className="p-1.5 md:p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0 disabled:opacity-30">',
  '      <div className="relative z-40 h-12 md:h-14 bg-stone-800 border-b border-white/10 flex items-center justify-between px-2 md:px-4 shrink-0 min-w-0 safe-top pointer-events-auto">\n        <div className="flex items-center gap-2 md:gap-4 min-w-0">\n          <button type="button" data-score-viewer-close onClick={handleClose} disabled={isClosing} className="p-1.5 md:p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors shrink-0 disabled:opacity-30">'
);

content = content.replace(
  '            <>\n              <button \n                onClick={() => {',
  '            <>\n              <button \n                type="button"\n                onClick={() => {'
);

content = content.replace(
  '      <div \n        ref={scoreViewportRef}\n        className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch]"',
  '      <div \n        ref={scoreViewportRef}\n        data-score-viewer-viewport\n        className="relative z-0 min-h-0 min-w-0 overflow-auto overscroll-contain bg-stone-900 px-0 py-2 md:px-4 md:py-4 [-webkit-overflow-scrolling:touch] pointer-events-auto select-none"'
);

fs.writeFileSync('src/components/score-viewer/ScoreViewer.tsx', content, 'utf8');
console.log('done');
