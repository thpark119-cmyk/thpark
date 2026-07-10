import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """            <div className="flex justify-center gap-1 mt-4">
              {settings.beatStates.map((state, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-75 ${
                    isPlaying && currentBeat === i && !isSilentPhase
                      ? state === 'accent' ? 'bg-brand scale-125 shadow-[0_0_15px_rgba(var(--brand),0.5)]' : 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>"""

replacement = """            <div className="flex justify-center flex-wrap gap-1 mt-4">
              {settings.beatStates.map((state, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-75 ${
                    isPlaying && currentBeat === i && !isSilentPhase
                      ? state === 'accent' ? 'bg-brand scale-125 shadow-[0_0_15px_rgba(var(--brand),0.5)]' : 
                        state === 'secondary' ? 'bg-brand/50 scale-110 shadow-[0_0_10px_rgba(var(--brand),0.3)]' :
                        'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
