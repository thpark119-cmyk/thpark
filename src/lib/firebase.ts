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

const app = initializeApp(finalConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);

// Use local persistence and wait for it
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("Auth persistence set to local"))
  .catch(err => {
    console.error("Persistence error:", err);
  });

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
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

export const logout = () => signOut(auth);

// Test connection as required by integration instructions
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
