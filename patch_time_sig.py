import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """  const updateTimeSignature = (num: number, den: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      if (num > newStates.length) {
        for (let i = newStates.length; i < num; i++) {
          newStates.push('normal');
        }
      } else if (num < newStates.length) {
        newStates.length = num;
      }
      if (newStates.length > 0) {
        newStates[0] = 'accent';
      }
      return { ...s, numerator: num, denominator: den, beatStates: newStates };
    });
  };"""

replacement = """  const updateTimeSignature = (num: number, den: number) => {
    setSettings(s => {
      const newStates = getDefaultBeatStates(num, den);
      return { ...s, numerator: num, denominator: den, beatStates: newStates };
    });
  };"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
