import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const candidateFiles = [
    "firebase-service-account.json",
    "firebase-service-account1.json",
    "firebase-service-account2.json",
  ].map((f) => path.join(__dirname, "..", f));

  const envCreds = process.env.FIREBASE_ADMIN_JSON || null;
  if (envCreds) {
    try {
      const parsed = JSON.parse(envCreds);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      console.log(
        "[set-admin] Initialized firebase-admin from FIREBASE_ADMIN_JSON"
      );
      return admin;
    } catch (e) {
      console.error(
        "[set-admin] Failed to parse FIREBASE_ADMIN_JSON:",
        e.message || e
      );
      throw e;
    }
  }

  const pathFound = candidateFiles.find((p) => fs.existsSync(p));
  if (pathFound) {
    try {
      const sa = JSON.parse(fs.readFileSync(pathFound, "utf8"));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log(
        `[set-admin] Initialized firebase-admin from file: ${pathFound}`
      );
      return admin;
    } catch (e) {
      console.error(
        "[set-admin] Failed to initialize from file:",
        e.message || e
      );
      throw e;
    }
  }

  throw new Error(
    "No Firebase admin credentials found. Set FIREBASE_ADMIN_JSON env or place service account JSON in project root."
  );
}

async function setAdminClaim(email) {
  try {
    const adm = await initFirebaseAdmin();
    const user = await adm.auth().getUserByEmail(String(email));
    await adm.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`[set-admin] ✅ Admin claim set for ${email} (${user.uid})`);
    console.log(
      "User must sign out and sign back in for the claim to take effect."
    );
    return true;
  } catch (e) {
    console.error("[set-admin] Error:", e.message || e);
    return false;
  }
}

function usage() {
  console.log("Usage: node scripts/set-admin.js --email someone@example.com");
  console.log("Or set ADMIN_EMAIL env and run: node scripts/set-admin.js");
}

async function main() {
  const argv = process.argv.slice(2);
  let email = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" || a === "-e") {
      email = argv[i + 1];
      break;
    }
    if (a.startsWith("--email=")) {
      email = a.split("=")[1];
      break;
    }
  }
  if (!email) email = process.env.ADMIN_EMAIL || null;
  if (!email) {
    usage();
    process.exit(2);
  }

  const ok = await setAdminClaim(email);
  process.exit(ok ? 0 : 1);
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith("set-admin.js")
) {
  main();
}
