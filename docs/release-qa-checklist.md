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

## Data & Storage Management & Admin Backfill (Phase 2 & 3)
- [ ] "저장 데이터 현황" (Storage Status) section displays under Settings > Data Management
- [ ] Recalculate button works and displays rotating spinner during refresh
- [ ] Signed-in user: displays Student Photos, Lesson Journal Photos, Repertoire Files counts and sizes from Cloud
- [ ] Unsigned user: displays "로그인 후 확인 가능" guidance under Cloud storage
- [ ] Local storage: displays local IndexedDB photos count
- [ ] Local storage: displays LocalStorage fallback records count
- [ ] Language switching properly translates all storage fields (KO, EN, DE) without English fallback leaks
- [ ] Admin Backfill: Scan Candidates finds files with size=0 or undefined
- [ ] Admin Backfill: storage metadata lookup yields proper file sizes and contentTypes
- [ ] Admin Backfill: 'Save Corrigible Files' is disabled if no scan results, and only saves successful `metadata-found` items
- [ ] Admin Backfill: cache upsert works (saves to `adminMetadataCache/{cacheId}`) using safe sanitized storagePath keys
- [ ] Admin Backfill: cache excludes files with failures (permission-denied, not-found) from success logs
- [ ] Admin Backfill: no PII (emails, original names, names) is written to cache documents or logged in browser console
- [ ] Admin Backfill: user documents in `/users` remain completely unmodified
- [ ] Admin Backfill: admin storage dashboard recalculates instantly by joining original Firestore metadata with the admin cache
- [ ] Admin Backfill: unauthorized users (non-logged-in or standard users) are strictly blocked from seeing or invoking backfill tools

## Build / Deploy
- [ ] npm run build
- [ ] Vercel deploy
- [ ] Direct public page URLs work
