import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """          <div className="flex flex-wrap justify-center gap-2 md:gap-3 py-4">
            {settings.beatStates.map((state, i) => (
              <button
                key={i}
                onClick={() => cycleBeatState(i)}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all flex items-center justify-center
                  ${isPlaying && currentBeat === i ? 'ring-4 ring-white/20' : ''}
                  ${state === 'accent' ? 'bg-brand border-brand' : 
                    state === 'normal' ? 'bg-stone-700 border-stone-600' : 
                    'bg-transparent border-stone-800 text-stone-600'
                  }
                `}
              >
                {state === 'mute' && <VolumeX size={16} />}
              </button>
            ))}
          </div>"""

replacement = """          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{t('metronome.beatAccents') || '박 강약 설정'}</p>
              <button
                onClick={() => updateTimeSignature(settings.numerator, settings.denominator)}
                className="text-[10px] font-bold text-stone-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                {t('metronome.resetPattern') || '기본 패턴으로 초기화'}
              </button>
            </div>
            <p className="text-[10px] text-stone-500">{t('metronome.tapToChangeAccent') || '각 박을 눌러 강약을 변경할 수 있습니다.'}</p>
            <div className="flex flex-wrap gap-2 md:gap-3 justify-center bg-stone-900/50 p-4 rounded-2xl border border-white/5">
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
            </div>
          </div>"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
