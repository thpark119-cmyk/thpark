import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """  const loadPreset = (preset: MetronomePreset) => {
    setSettings({
      bpm: preset.bpm,
      numerator: preset.numerator,
      denominator: preset.denominator,
      beatStates: preset.beatStates,
      volume: preset.volume,
      isMuted: preset.isMuted,
    });
  };"""

replacement = """  const loadPreset = (preset: MetronomePreset) => {
    setSettings({
      bpm: preset.bpm,
      numerator: preset.numerator,
      denominator: preset.denominator,
      beatStates: preset.beatStates && preset.beatStates.length === preset.numerator ? preset.beatStates : getDefaultBeatStates(preset.numerator, preset.denominator),
      volume: preset.volume,
      isMuted: preset.isMuted,
    });
  };"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
