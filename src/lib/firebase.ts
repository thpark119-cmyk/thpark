import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Use environment variables if available (Vite standard), fallback to config file
const finalConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId
};

console.log("Firebase initializing with Project ID:", finalConfig.projectId);

let app: any = null;
export let db: any = null;
export let auth: any = null;
export let isFirebaseReady = false;

const hasRequiredConfig = Boolean(finalConfig.apiKey && finalConfig.projectId);

if (hasRequiredConfig) {
  try {
    app = initializeApp(finalConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
    auth = getAuth(app);
    isFirebaseReady = true;

    // Use local persistence and wait for it
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log("Auth persistence set to local"))
      .catch(err => {
        console.error("Persistence error:", err);
      });
  } catch (err) {
    console.warn("Firebase initialization failed (please check credentials):", err);
  }
} else {
  console.warn("Firebase credentials are not set. MusicianLog will run in standard local-only fallback mode (localStorage).");
}

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  if (!isFirebaseReady || !auth) {
    throw new Error("Firebase가 준비되지 않았습니다. 현재 로컬 저장 모드로 동작 중입니다.");
  }
  try {
    // Force prompt to ensure user can switch accounts easily
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    await setPersistence(auth, browserLocalPersistence);
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Auth Popup Error:", error);
    throw error;
  }
};

export const handleRedirectResult = async () => {
  // Using popup, so redirect result is not used but kept for context compatibility
  return null;
};

export const logout = async () => {
  if (isFirebaseReady && auth) {
    return signOut(auth);
  }
};

// Test connection as required by integration instructions
export async function testConnection() {
  if (!isFirebaseReady || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

