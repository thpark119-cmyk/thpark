import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """  const cycleBeatState = (index: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      const current = newStates[index];
      const next: BeatState = current === 'accent' ? 'normal' : current === 'normal' ? 'mute' : 'accent';
      newStates[index] = next;
      return { ...s, beatStates: newStates };
    });
  };"""

replacement = """  const cycleBeatState = (index: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      const current = newStates[index];
      let next: BeatState = 'normal';
      if (current === 'accent') next = 'secondary';
      else if (current === 'secondary') next = 'normal';
      else if (current === 'normal') next = 'mute';
      else if (current === 'mute') next = 'accent';
      newStates[index] = next;
      return { ...s, beatStates: newStates };
    });
  };"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
