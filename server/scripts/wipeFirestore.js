// Danger: wipes Firestore collections defined in schema.js
import { firestore } from "../db/firebaseAdmin.js";
import { COLLECTIONS } from "../db/schema.js";

async function wipeCollection(name) {
  const col = firestore.collection(name);
  const snap = await col.get();
  const batchSize = 400;
  let count = 0;
  let batch = firestore.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = firestore.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit();
  }
  console.log(`[wipe] ${name}: deleted ${count} docs`);
}

async function main() {
  if (!firestore) {
    console.error("Firestore not initialized. Set FIREBASE_SERVICE_ACCOUNT.");
    process.exit(1);
  }
  const yes = process.env.CONFIRM_WIPE === "yes";
  if (!yes) {
    console.error("Set CONFIRM_WIPE=yes to confirm wiping Firestore.");
    process.exit(2);
  }
  const names = [
    COLLECTIONS.USERS,
    COLLECTIONS.COMPANIES,
    COLLECTIONS.FEEDBACK,
    COLLECTIONS.MESSAGES,
    COLLECTIONS.ADMIN_USERS,
    // ADMIN_SETTINGS is small; optionally wipe key docs manually
  ];
  for (const n of names) {
    await wipeCollection(n);
  }
  console.log("[wipe] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
