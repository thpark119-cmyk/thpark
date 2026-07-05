# Music In One Release QA Checklist

## Account
- [ ] Google login works
- [ ] Logout works
- [ ] Account deletion warning appears
- [ ] Account deletion works with a test account
- [ ] requires-recent-login error is handled

## Privacy / Legal
- [ ] /privacy.html opens without login
- [ ] /account-deletion.html opens without login
- [ ] Privacy Policy link works from Settings
- [ ] Account Deletion Guide link works from Settings
- [ ] Contact email link works

## Lesson Logs
- [ ] Create
- [ ] Edit
- [ ] Delete
- [ ] Firestore sync
- [ ] Local fallback

## Student Management
- [ ] Create student
- [ ] Add lesson entry
- [ ] Edit lesson entry
- [ ] Delete lesson entry
- [ ] Add local photo
- [ ] View local photo
- [ ] Delete local photo

## Repertoire
- [ ] Create record
- [ ] Edit record
- [ ] Delete record
- [ ] IMSLP search opens correctly

## Tuner
- [ ] Microphone permission prompt appears
- [ ] Pitch detection works
- [ ] Tone generator works
- [ ] A4 reference setting works
- [ ] Mobile sound works

## Metronome
- [ ] Start/stop works
- [ ] BPM change works
- [ ] Time signature works
- [ ] Accent/normal/mute works
- [ ] Tap tempo works
- [ ] Presets/setlists work
- [ ] Practice mode works
- [ ] Mobile scroll is acceptable

## Language
- [ ] Korean
- [ ] English
- [ ] German

## Mobile
- [ ] iPhone Safari
- [ ] iPhone Chrome
- [ ] Android Chrome
- [ ] Mobile layout
- [ ] Safe area
- [ ] Bottom navigation
- [ ] Settings access

## Data & Storage Management
- [ ] "저장 데이터 현황" (Storage Status) section displays under Settings > Data Management
- [ ] Recalculate button works and displays rotating spinner during refresh
- [ ] Signed-in user: displays Student Photos, Lesson Journal Photos, Repertoire Files counts and sizes from Cloud
- [ ] Unsigned user: displays "로그인 후 확인 가능" guidance under Cloud storage
- [ ] Local storage: displays local IndexedDB photos count
- [ ] Local storage: displays LocalStorage fallback records count
- [ ] Language switching properly translates all storage fields (KO, EN, DE) without English fallback leaks

## Build / Deploy
- [ ] npm run build
- [ ] Vercel deploy
- [ ] Direct public page URLs work
