import re

with open('src/i18n/translations.ts', 'r') as f:
    content = f.read()

content = content.replace("      normal: '약박',\n", "")
content = content.replace("      normal: 'Weak',\n", "")
content = content.replace("      normal: 'Schwach',\n", "")

with open('src/i18n/translations.ts', 'w') as f:
    f.write(content)
