import re

with open('src/i18n/translations.ts', 'r') as f:
    content = f.read()

# Add ko translations
ko_target = "accent: '강박',"
ko_replacement = "accent: '강박',\n      secondary: '중강박',\n      normal: '약박',\n      accentLabel: '강',\n      secondaryLabel: '중',\n      normalLabel: '약',\n      beatAccents: '박 강약 설정',\n      tapToChangeAccent: '각 박을 눌러 강약을 변경할 수 있습니다.',\n      compoundMeterPattern: '복합박자 기본 패턴',\n      resetPattern: '기본 패턴으로 초기화',\n      firstBeat: '첫 박',\n      currentBeat: '현재 박',\n      beat: '박',"
content = content.replace(ko_target, ko_replacement)

# Add en translations
en_target = "accent: 'Accent',"
en_replacement = "accent: 'Strong',\n      secondary: 'Secondary',\n      normal: 'Weak',\n      accentLabel: 'S',\n      secondaryLabel: 'M',\n      normalLabel: 'W',\n      beatAccents: 'Beat Accents',\n      tapToChangeAccent: 'Tap each beat to change its accent.',\n      compoundMeterPattern: 'Compound Meter Pattern',\n      resetPattern: 'Reset to Default Pattern',\n      firstBeat: 'First Beat',\n      currentBeat: 'Current Beat',\n      beat: 'Beat',"
content = content.replace(en_target, en_replacement)

# Add de translations
de_target = "accent: 'Betont',"
de_replacement = "accent: 'Stark',\n      secondary: 'Nebenbetonung',\n      normal: 'Schwach',\n      accentLabel: 'S',\n      secondaryLabel: 'N',\n      normalLabel: 'W',\n      beatAccents: 'Betonungen',\n      tapToChangeAccent: 'Tippe auf einen Schlag, um seine Betonung zu ändern.',\n      compoundMeterPattern: 'Muster für zusammengesetzte Taktarten',\n      resetPattern: 'Auf Standardmuster zurücksetzen',\n      firstBeat: 'Erster Schlag',\n      currentBeat: 'Aktueller Schlag',\n      beat: 'Schlag',"
content = content.replace(de_target, de_replacement)

with open('src/i18n/translations.ts', 'w') as f:
    f.write(content)
