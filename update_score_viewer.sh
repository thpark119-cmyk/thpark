#!/bin/bash
sed -i '986,1147c\
                {currentTool !== '"'"'eraser'"'"' && (\
                  <>\
                    <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">\
                      {['"'"'#ef4444'"'"', '"'"'#3b82f6'"'"', '"'"'#22c55e'"'"', '"'"'#eab308'"'"', '"'"'#000000'"'"', '"'"'#ffffff'"'"'].map(color => {\
                        const isSelected = strokeColor === color;\
                        return (\
                          <button \
                            key={color}\
                            type="button"\
                            onClick={() => setStrokeColor(color)}\
                            aria-pressed={isSelected}\
                            title={isSelected ? '"'"'현재 선택된 색상'"'"' : '"'"'색상 변경'"'"'}\
                            aria-label={isSelected ? `현재 선택된 색상 ${color}` : `색상 ${color}`}\
                            className={`relative w-7 h-7 md:w-6 md:h-6 shrink-0 rounded-full border-2 box-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-stone-900 ${\
                              isSelected\
                                ? '"'"'border-white ring-2 ring-white/90 ring-offset-1 ring-offset-stone-900'"'"'\
                                : '"'"'border-stone-600 hover:border-stone-300'"'"'\
                            }`}\
                            style={{ backgroundColor: color }}\
                          />\
                        );\
                      })}\
                    </div>\
                    \
                    <div className="flex items-center gap-2 bg-stone-900 rounded-lg p-1 shrink-0">\
                      {[1, 2, 3].map(w => (\
                        <button\
                          key={w}\
                          onClick={() => setStrokeWidth(w)}\
                          className={`w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded ${strokeWidth === w ? '"'"'bg-stone-700 text-brand'"'"' : '"'"'text-stone-400 hover:text-white'"'"'}`}\
                          title={`굵기 ${w}`}\
                          aria-label={`굵기 ${w}`}\
                        >\
                          <div className="bg-current rounded-full" style={{ width: w * 2 + 2, height: w * 2 + 2 }} />\
                        </button>\
                      ))}\
                    </div>\
                  </>\
                )}\
\
                {currentTool === '"'"'eraser'"'"' && (\
                  <div className="flex items-center gap-2 shrink-0" role="group" aria-label="지우개 크기">\
                    <span className="shrink-0 text-xs text-stone-400 px-1">지우개 크기</span>\
                    {ERASER_RADIUS_OPTIONS.map(option => (\
                      <button\
                        key={option.value}\
                        type="button"\
                        title={`지우개 ${option.label}`}\
                        aria-label={`지우개 크기 ${option.label}`}\
                        aria-pressed={eraserRadius === option.value}\
                        onClick={() => setEraserRadius(option.value)}\
                        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${eraserRadius === option.value ? '"'"'bg-brand/20 text-brand ring-1 ring-brand/50'"'"' : '"'"'bg-stone-900 text-stone-400 hover:text-white hover:bg-stone-700'"'"'}`}\
                      >\
                        <span className="block rounded-full border-2 border-current bg-current/10" style={{ width: `${option.previewSize}px`, height: `${option.previewSize}px` }} />\
                      </button>\
                    ))}\
                  </div>\
                )}\
              </div>\
            </div>\
          )}\
        </div>\
      </div>\
' src/components/score-viewer/ScoreViewer.tsx
