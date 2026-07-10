import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """            <div className="flex flex-wrap gap-2 md:gap-3 justify-center bg-stone-900/50 p-4 rounded-2xl border border-white/5">
              {settings.beatStates.map((state, i) => (
                <button
                  key={i}
                  onClick={() => cycleBeatState(i)}
                  aria-label={`${i+1}${t('metronome.beat') || '박'}: ${state}`}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all flex flex-col items-center justify-center
                    ${isPlaying && currentBeat === i ? 'ring-4 ring-white/20' : ''}
                    ${state === 'accent' ? 'bg-brand border-brand text-stone-950 shadow-[0_0_15px_rgba(var(--brand),0.3)]' : 
                      state === 'secondary' ? 'bg-brand/30 border-brand/50 text-brand' :
                      state === 'normal' ? 'bg-stone-700 border-stone-600 text-stone-300' : 
                      'bg-transparent border-stone-800 text-stone-600'
                    }
                  `}
                >
                  {state === 'mute' ? <VolumeX size={14} className="mb-0.5" /> : (
                    <span className="text-[10px] md:text-xs font-bold leading-none mb-0.5">
                      {state === 'accent' ? (t('metronome.accentLabel') || '강') :
                       state === 'secondary' ? (t('metronome.secondaryLabel') || '중') :
                       (t('metronome.normalLabel') || '약')}
                    </span>
                  )}
                  <span className="text-[8px] opacity-60 font-mono">{i + 1}</span>
                </button>
              ))}
            </div>"""

replacement = """            <div className="flex flex-wrap gap-2 md:gap-3 justify-center bg-stone-900/50 p-4 rounded-2xl border border-white/5">
              {settings.beatStates.map((state, i) => (
                <button
                  key={i}
                  onClick={() => cycleBeatState(i)}
                  aria-label={`${i+1}${t('metronome.beat') || '박'}: ${state}`}
                  title={`${i+1}${t('metronome.beat') || '박'}: ${state}`}
                  className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center relative transition-all group shrink-0
                    ${settings.denominator === 8 && [6, 9, 12].includes(settings.numerator) && i % 3 === 0 && i !== 0 ? 'ml-3 md:ml-4' : ''}
                  `}
                >
                  {isPlaying && currentBeat === i && !isSilentPhase && (
                    <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-pulse scale-125 md:scale-[1.2]" />
                  )}
                  
                  <span
                    className={`rounded-full transition-all duration-200 ease-out flex items-center justify-center
                      ${state === 'accent' ? 'w-7 h-7 md:w-8 md:h-8 bg-brand border-2 border-brand shadow-[0_0_12px_rgba(var(--brand),0.6)]' : ''}
                      ${state === 'secondary' ? 'w-5 h-5 md:w-6 md:h-6 bg-brand/80 border-[1.5px] border-brand' : ''}
                      ${state === 'normal' ? 'w-3.5 h-3.5 md:w-[18px] md:h-[18px] bg-stone-500/50 border border-stone-500' : ''}
                      ${state === 'mute' ? 'w-[18px] h-[18px] md:w-5 md:h-5 bg-transparent border-[1.5px] border-dashed border-stone-600 opacity-40' : ''}
                    `}
                  />
                </button>
              ))}
            </div>"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
