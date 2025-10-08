import admin from 'firebase-admin';

// Initialize Firebase Admin SDK using env var for service account JSON.
// Set FIREBASE_SERVICE_ACCOUNT to the JSON string OR path to the JSON file.

function getServiceAccount() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) return null;
  try {
    // If it's a JSON string
    if (svc.trim().startsWith('{')) return JSON.parse(svc);
    // Otherwise assume it's a file path
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sa = require(svc);
    return sa;
  } catch {
    return null;
  }
}

if (!admin.apps.length) {
  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  } else {
    // Allow running without Firestore for local SMS features; DB routes will 503
    console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT not set. Firestore features disabled.');
  }
}

export const firestore = admin.apps.length ? admin.firestore() : null;
export { admin };
