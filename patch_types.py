import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = "type BeatState = 'accent' | 'normal' | 'mute';"
replacement = "export type BeatState = 'accent' | 'secondary' | 'normal' | 'mute';\n\nconst getDefaultBeatStates = (num: number, den: number): BeatState[] => {\n  const ts = `${num}/${den}`;\n  if (ts === '2/4') return ['accent', 'normal'];\n  if (ts === '3/4') return ['accent', 'normal', 'normal'];\n  if (ts === '4/4') return ['accent', 'normal', 'normal', 'normal'];\n  if (ts === '6/8') return ['accent', 'normal', 'normal', 'secondary', 'normal', 'normal'];\n  if (ts === '9/8') return ['accent', 'normal', 'normal', 'secondary', 'normal', 'normal', 'secondary', 'normal', 'normal'];\n  if (ts === '12/8') return ['accent', 'normal', 'normal', 'secondary', 'normal', 'normal', 'secondary', 'normal', 'normal', 'secondary', 'normal', 'normal'];\n  const arr: BeatState[] = Array(num).fill('normal');\n  if (num > 0) arr[0] = 'accent';\n  return arr;\n};"

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
