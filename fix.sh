#!/bin/bash
sed -i '985a\
          {/* Second Line: Properties */}\
          {currentTool !== '"'"'none'"'"' && (\
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1">\
              <div className="flex items-center gap-3 w-max min-w-full justify-center md:justify-start mx-auto md:mx-0">\
                {touchModeButton}\
' src/components/score-viewer/ScoreViewer.tsx
