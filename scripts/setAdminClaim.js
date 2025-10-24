#!/usr/bin/env node
/*
 * scripts/setAdminClaim.js
 *
 * Usage:
 *   node scripts/setAdminClaim.js <UID> [--admin=true|false]
 *
 * The script will load Firebase service account credentials from one of:
 *  - FIREBASE_ADMIN_JSON environment variable (JSON or base64-encoded JSON)
 *  - ./firebase-service-account2.json (project root)
 *
 * It will then set the custom claim { admin: true } (or false) on the specified UID.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function usage() {
  console.log(
    "Usage: node scripts/setAdminClaim.js <UID> [--admin=true|false]"
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length < 1) {
  usage();
}

const uid = argv[0];
let adminFlag = true;
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--admin=")) {
    const v = a.split("=")[1];
    adminFlag = !(v === "false" || v === "0");
  }
}

function loadServiceAccount() {
  // 1) Check FIREBASE_ADMIN_JSON env var
  const envJson = process.env.FIREBASE_ADMIN_JSON;
  if (envJson) {
    try {
      // If looks like base64 (no leading { ) try decode
      const trimmed = envJson.trim();
      let parsed = null;
      if (trimmed.startsWith("{")) {
        parsed = JSON.parse(trimmed);
      } else {
        // try base64
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        parsed = JSON.parse(decoded);
      }
      return parsed;
    } catch (e) {
      console.error(
        "Failed to parse FIREBASE_ADMIN_JSON environment variable:",
        e.message || e
      );
      // fallthrough to file
    }
  }

  // 2) Try firebase-service-account2.json in project root
  const candidates = [
    path.resolve(__dirname, "..", "firebase-service-account2.json"),
    path.resolve(__dirname, "..", "firebase-service-account.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
      } catch (e) {
        console.error(
          "Failed to parse service account file:",
          p,
          e.message || e
        );
      }
    }
  }

  return null;
}

async function main() {
  const svc = loadServiceAccount();
  if (!svc) {
    console.error(
      "No Firebase service account found. Set FIREBASE_ADMIN_JSON env var or place firebase-service-account2.json in project root."
    );
    process.exit(2);
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(svc),
    });
  } catch (e) {
    // If already initialized in this process, ignore
    if (!/already exists/.test(String(e))) {
      console.error("Failed to initialize Firebase Admin SDK:", e.message || e);
      process.exit(3);
    }
  }

  try {
    console.log(
      `Setting custom claim { admin: ${adminFlag} } for UID: ${uid} ...`
    );
    await admin.auth().setCustomUserClaims(uid, { admin: adminFlag });
    console.log("Success: custom claim updated.");
    console.log(
      "Note: the user must obtain a new ID token (sign out & sign in or call getIdToken(true)) for the change to take effect in clients."
    );
    process.exit(0);
  } catch (e) {
    console.error("Failed to set custom claim:", e.message || e);
    process.exit(4);
  }
}

main();
