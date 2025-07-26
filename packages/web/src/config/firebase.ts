import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nxtai-production.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nxtai-production",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nxtai-production.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize Analytics only in production
let analytics;
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  analytics = getAnalytics(app);
}
export { analytics };

// Connect to emulators in development
if (import.meta.env.DEV) {
  const isEmulatorConnected = {
    auth: false,
    firestore: false,
    storage: false,
    functions: false
  };

  // Auth emulator
  if (!isEmulatorConnected.auth) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      isEmulatorConnected.auth = true;
      console.log('🔥 Connected to Auth emulator');
    } catch (error) {
      console.warn('Failed to connect to Auth emulator:', error);
    }
  }

  // Firestore emulator
  if (!isEmulatorConnected.firestore) {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
      isEmulatorConnected.firestore = true;
      console.log('🔥 Connected to Firestore emulator');
    } catch (error) {
      console.warn('Failed to connect to Firestore emulator:', error);
    }
  }

  // Storage emulator
  if (!isEmulatorConnected.storage) {
    try {
      connectStorageEmulator(storage, 'localhost', 9199);
      isEmulatorConnected.storage = true;
      console.log('🔥 Connected to Storage emulator');
    } catch (error) {
      console.warn('Failed to connect to Storage emulator:', error);
    }
  }

  // Functions emulator
  if (!isEmulatorConnected.functions) {
    try {
      connectFunctionsEmulator(functions, 'localhost', 5001);
      isEmulatorConnected.functions = true;
      console.log('🔥 Connected to Functions emulator');
    } catch (error) {
      console.warn('Failed to connect to Functions emulator:', error);
    }
  }
}

export default app;

