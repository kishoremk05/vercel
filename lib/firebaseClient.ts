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

/**
 * Wait for a Firebase ID token to become available. Useful when the app
 * has just redirected from an OAuth provider and auth state restoration
 * may take a short moment. Resolves to the ID token string or null on
 * timeout/failure.
 */
export async function waitForAuthToken(timeoutMs = 5000): Promise<string | null> {
  try {
    initializeFirebase();
    const authObj = getAuth();
    // If currentUser already present, return its token immediately
    if (authObj && (authObj as any).currentUser) {
      try {
        const t = await (authObj as any).currentUser.getIdToken();
        return t || null;
      } catch (e) {
        return null;
      }
    }
    // Otherwise wait for onAuthStateChanged or timeout
    return await new Promise((resolve) => {
      let resolved = false;
      try {
        const unsub = authObj.onAuthStateChanged(async (u: any) => {
          if (u) {
            try {
              const token = await u.getIdToken();
              resolved = true;
              try {
                unsub();
              } catch {}
              resolve(token || null);
            } catch (err) {
              resolved = true;
              try {
                unsub();
              } catch {}
              resolve(null);
            }
          }
        });
        setTimeout(() => {
          if (!resolved) {
            try {
              unsub();
            } catch {}
            resolve(null);
          }
        }, timeoutMs);
      } catch (e) {
        resolve(null);
      }
    });
  } catch (e) {
    return null;
  }
}
