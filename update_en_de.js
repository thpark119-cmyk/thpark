const fs = require('fs');
let content = fs.readFileSync('src/i18n/translations.ts', 'utf8');
content = content.replace(
  "outputAudioState: 'Output audio state',\n      tapToPlaySound: 'Tap the button once more to play sound.',",
  "outputAudioState: 'Output audio state',\n      iosAudioWarning: 'On iPhone Silent Mode, web app audio may be limited. This app tries to keep audio audible, but behavior may vary by browser or in-app browser.',\n      audioQualityImprovement: 'Audio Quality Improvement',\n      noiseReduction: 'Noise Reduction',\n      smoothClickSound: 'Smooth Click Sound',\n      tapToPlaySound: 'Tap the button once more to play sound.',"
);
content = content.replace(
  "outputAudioState: 'Ausgabe-Audiostatus',\n      tapToPlaySound: 'Tippe die Taste erneut, um Ton abzuspielen.',",
  "outputAudioState: 'Ausgabe-Audiostatus',\n      iosAudioWarning: 'Im iPhone-Stummmodus kann Web-App-Audio eingeschränkt sein. Diese App versucht, Audio hörbar zu halten, aber das Verhalten kann je nach Browser oder In-App-Browser variieren.',\n      audioQualityImprovement: 'Verbesserung der Audioqualität',\n      noiseReduction: 'Rauschreduzierung',\n      smoothClickSound: 'Weicher Klickklang',\n      tapToPlaySound: 'Tippe die Taste erneut, um Ton abzuspielen.',"
);
fs.writeFileSync('src/i18n/translations.ts', content);
