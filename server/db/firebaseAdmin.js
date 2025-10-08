import admin from "firebase-admin";
import fs from "fs";

function getServiceAccount() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.warn("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT env not set");
    return null;
  }
  try {
    if (svc.trim().startsWith("{")) {
      console.log("[firebaseAdmin] Loading from JSON string");
      return JSON.parse(svc);
    }
    // Assume it's a path
    console.log("[firebaseAdmin] Loading from file:", svc);
    const raw = fs.readFileSync(svc, "utf8");
    const parsed = JSON.parse(raw);
    console.log(
      "[firebaseAdmin] Loaded service account for project:",
      parsed.project_id
    );
    return parsed;
  } catch (e) {
    console.error("[firebaseAdmin] Failed to load service account:", e.message);
    return null;
  }
}

if (!admin.apps.length) {
  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[firebaseAdmin] Firebase Admin initialized successfully");
  } else {
    console.warn(
      "[firebase] FIREBASE_SERVICE_ACCOUNT not set. Firestore features disabled."
    );
  }
}

export const firestore = admin.apps.length ? admin.firestore() : null;
export { admin };
