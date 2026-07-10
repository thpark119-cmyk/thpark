import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = "className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center relative transition-all group shrink-0"
replacement = "className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center relative transition-all group shrink-0"

content = content.replace(target, replacement)

target2 = "state === 'normal' ? 'w-3.5 h-3.5 md:w-[18px] md:h-[18px]"
replacement2 = "state === 'normal' ? 'w-4 h-4 md:w-[18px] md:h-[18px]"

content = content.replace(target2, replacement2)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
