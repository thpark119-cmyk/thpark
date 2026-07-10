import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """  const [customNumerator, setCustomNumerator] = useState('4');
  const [customDenominator, setCustomDenominator] = useState('4');"""

replacement = """  const [customNumerator, setCustomNumerator] = useState(settings.numerator.toString());
  const [customDenominator, setCustomDenominator] = useState(settings.denominator.toString());

  useEffect(() => {
    setCustomNumerator(settings.numerator.toString());
    setCustomDenominator(settings.denominator.toString());
  }, [settings.numerator, settings.denominator]);"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
