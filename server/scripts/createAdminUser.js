#!/usr/bin/env node
/**
 * createAdminUser.js
 *
 * One-off utility to create or update an admin Authentication user
 * and create a basic admin record in Firestore.
 *
 * Usage:
 *   node server/scripts/createAdminUser.js --email admin@you.com --password Passw0rd!
 *
 * It will read service account from ./firebase-service-account2.json (or similar)
 * or from FIREBASE_ADMIN_JSON env var.
 */

import fs from "fs";
import path from "path";
import admin from "firebase-admin";

function loadServiceAccount() {
  const envJson = process.env.FIREBASE_ADMIN_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch (e) {
      console.error("Failed to parse FIREBASE_ADMIN_JSON:", e.message || e);
      process.exit(1);
    }
  }

  const candidate = [
    "firebase-service-account.json",
    "firebase-service-account1.json",
    "firebase-service-account2.json",
  ]
    .map((f) => path.join(process.cwd(), f))
    .find((p) => fs.existsSync(p));

  if (!candidate) {
    console.error(
      "No service account file found. Place firebase-service-account2.json in repo root or set FIREBASE_ADMIN_JSON."
    );
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(candidate, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read service account file:", e.message || e);
    process.exit(1);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" && argv[i + 1]) {
      out.email = argv[++i];
      continue;
    }
    if (a === "--password" && argv[i + 1]) {
      out.password = argv[++i];
      continue;
    }
    if (a === "--displayName" && argv[i + 1]) {
      out.displayName = argv[++i];
      continue;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.email || !args.password) {
    console.error(
      'Usage: node server/scripts/createAdminUser.js --email admin@you.com --password Passw0rd! [--displayName "Admin Name"]'
    );
    process.exit(1);
  }

  const serviceAccount = loadServiceAccount();

  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    // ignore if already initialized
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    // Try to find existing user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(args.email);
      console.log("Found existing user:", userRecord.uid);
      // Update password
      await auth.updateUser(userRecord.uid, {
        password: args.password,
        displayName: args.displayName || args.email,
      });
      console.log("Updated password and displayName for existing user");
    } catch (e) {
      // Create new user
      userRecord = await auth.createUser({
        email: args.email,
        password: args.password,
        displayName: args.displayName || args.email,
      });
      console.log("Created new user:", userRecord.uid);
    }

    // Optionally set a custom claim (admin) so app rules can check request.auth.token.admin
    try {
      await auth.setCustomUserClaims(userRecord.uid, { admin: true });
      console.log("Set custom claim admin:true for user");
    } catch (e) {
      console.warn("Failed to set custom claims:", e.message || e);
    }

    // Create an admin record in Firestore (admins/admin_<uid>)
    try {
      const docRef = db.collection("admins").doc(`admin_${userRecord.uid}`);
      await docRef.set(
        {
          name: args.displayName || args.email,
          email: args.email,
          auth_uid: userRecord.uid,
          role: "super_admin",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("Admin document created/updated in Firestore under admins/");
    } catch (e) {
      console.warn(
        "Failed to create admin document in Firestore:",
        e.message || e
      );
    }

    // Also ensure a users collection record exists (verifyFirebaseAdmin checks users collection)
    try {
      const usersRef = db.collection("users").doc(userRecord.uid);
      await usersRef.set(
        {
          uid: userRecord.uid,
          email: args.email,
          name: args.displayName || args.email,
          role: "superadmin", // normalized check in server expects 'admin' or 'superadmin'
          companyId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("Upserted user document in users/ with role superadmin");
    } catch (e) {
      console.warn("Failed to upsert users doc:", e.message || e);
    }

    // Save canonical admin reference into admin_settings/global (email + uid only)
    try {
      const adminSettingsRef = db.collection("admin_settings").doc("global");
      await adminSettingsRef.set(
        {
          adminUser: {
            uid: userRecord.uid,
            email: args.email,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("Wrote adminUser reference to admin_settings/global");
    } catch (e) {
      console.warn("Failed to write admin_settings/global:", e.message || e);
    }

    console.log("\n✅ Done. You can now sign in with:");
    console.log("   email:", args.email);
    console.log("   password:", args.password);
    console.log(
      "\nNote: This script set a custom claim `admin:true` on the user — it may take a minute to propagate."
    );
  } catch (e) {
    console.error("Error creating/updating admin user:", e.message || e);
    process.exit(1);
  }
}

main();
