import admin from "firebase-admin";
import fs from "fs";
import adminRoutes from "../routes/adminRoutes";

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

/**
 * Validate if the given UID belongs to an admin user.
 * @param {string} uid - The UID to validate.
 * @returns {Promise<boolean>} - True if the UID is valid, false otherwise.
 */
export async function validateAdminUid(uid) {
  if (!firestore) {
    console.error("[validateAdminUid] Firestore is not initialized.");
    return false;
  }

  try {
    const adminDoc = await firestore.collection("admins").doc(uid).get();
    if (adminDoc.exists) {
      console.log(`[validateAdminUid] UID ${uid} is a valid admin.`);
      return true;
    } else {
      console.warn(`[validateAdminUid] UID ${uid} is not an admin.`);
      return false;
    }
  } catch (error) {
    console.error("[validateAdminUid] Error validating UID:", error);
    return false;
  }
}

// Example of integrating the admin routes into your Express app
export function setupAdminRoutes(app) {
  app.use("/admin", adminRoutes);
}
