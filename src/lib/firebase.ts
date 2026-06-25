import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD3xeVDFdoTZ-lh3erXR70CeHoTr7Aq0yk",
  authDomain: "musicianlog.firebaseapp.com",
  databaseURL: "https://musicianlog-default-rtdb.firebaseio.com",
  projectId: "musicianlog",
  storageBucket: "musicianlog.firebasestorage.app",
  messagingSenderId: "325291971438",
  appId: "1:325291971438:web:ff8b5fe3dd8681ec7aa77f"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn('Firebase 초기화 실패. localStorage 모드로 작동합니다.', error);
}

const googleProvider = new GoogleAuthProvider();

export const isFirebaseReady = Boolean(app && auth && db);

export { auth, db };

export const signInWithGoogle = async () => {
  if (!auth) {
    throw new Error('Firebase Auth가 준비되지 않았습니다. 현재 로컬 저장 모드로 동작 중입니다.');
  }

  googleProvider.setCustomParameters({ prompt: 'select_account' });
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, googleProvider);
};

export const logout = async () => {
  if (!auth) {
    throw new Error('Firebase Auth가 준비되지 않았습니다.');
  }

  return signOut(auth);
};

