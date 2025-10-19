import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD0UEedFgMd28U7N8FAT1ApEgSQaMprRhw",
  authDomain: "feedback-saas-55009.firebaseapp.com",
  projectId: "feedback-saas-55009",
  storageBucket: "feedback-saas-55009.firebasestorage.app",
  messagingSenderId: "833982973763",
  appId: "1:833982973763:web:358d63e56e975c6f3191f6"
};

let app: any = null;
let auth: any = null;
let db: any = null;

export function initializeFirebase() {
  console.log('[firebase] initializeFirebase called');
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth();
    // Attempt to set persistence dynamically (avoids TS type issues if typings mismatch)
    import('firebase/auth').then(mod => {
      if (mod.setPersistence && mod.browserLocalPersistence) {
        mod.setPersistence(auth, mod.browserLocalPersistence).catch(err => {
          console.warn('[firebase] setPersistence failed:', err?.message || err);
        });
      }
    }).catch(()=>{});
    db = getFirestore(app);
    console.log('[firebase] Firebase initialized (new app)');
  } else {
    app = getApps()[0];
    auth = getAuth();
    import('firebase/auth').then(mod => {
      if (mod.setPersistence && mod.browserLocalPersistence) {
        mod.setPersistence(auth, mod.browserLocalPersistence).catch(err => {
          console.warn('[firebase] setPersistence failed:', err?.message || err);
        });
      }
    }).catch(()=>{});
    db = getFirestore(app);
    console.log('[firebase] Firebase initialized (existing app)');
  }
  return { app, auth, db };
}

export function getFirebaseAuth() {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

export function getFirebaseDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}
